// Package verifier implements a small, independently testable Go verification
// boundary for PCTR Ed25519 authority and receipt objects. It does not issue grants,
// classify consequences, inspect live systems, or authorize production by itself.
package verifier

import (
	"bytes"
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"math"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Result struct {
	Allowed         bool   `json:"allowed"`
	Reason          string `json:"reason"`
	SignerVerified  bool   `json:"signerVerified"`
	BindingHash     string `json:"bindingHash,omitempty"`
}

type Execution struct {
	Principal string         `json:"principal"`
	Action    string         `json:"action"`
	Target    string         `json:"target"`
	Params    map[string]any `json:"params"`
}

// Replay is an operator-controlled atomic nonce ledger. In-process memory may
// be useful in tests; production must use a durable transactional implementation.
type Replay interface {
	SpendOnce(nonce string) error
}

type MemoryReplay struct {
	mu sync.Mutex
	spent map[string]struct{}
}

func NewMemoryReplay() *MemoryReplay {
	return &MemoryReplay{spent: make(map[string]struct{})}
}

func (r *MemoryReplay) SpendOnce(nonce string) error {
	if nonce == "" { return errors.New("missing nonce") }
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.spent[nonce]; ok { return errors.New("replayed nonce") }
	r.spent[nonce] = struct{}{}
	return nil
}

func KeyID(key ed25519.PublicKey) (string,error) {
	if len(key) != ed25519.PublicKeySize { return "", errors.New("invalid Ed25519 public key") }
	der, err := x509.MarshalPKIXPublicKey(key)
	if err != nil { return "",err }
	p := strings.TrimSpace(string(pem.EncodeToMemory(&pem.Block{Type:"PUBLIC KEY",Bytes:der})))
	h := sha256.Sum256([]byte(p))
	return "ed25519:" + hex.EncodeToString(h[:])[:32],nil
}

func load(raw []byte) (map[string]any,error) {
	dec:=json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	var o map[string]any
	if err:=dec.Decode(&o);err!=nil{return nil,err}
	if o==nil{return nil,errors.New("expected JSON object")}
	var extra any
	if err:=dec.Decode(&extra);err!=io.EOF{return nil,errors.New("trailing JSON or invalid object")}
	return o,nil
}

func quote(s string) string {
	var b bytes.Buffer
	enc:=json.NewEncoder(&b)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(s)
	return strings.TrimSuffix(b.String(), "\n")
}

func canonical(v any) (string,error) {
	switch x:=v.(type) {
	case nil: return "null",nil
	case bool: if x{return "true",nil};return "false",nil
	case string: return quote(x),nil
	case json.Number:
		f,e:=strconv.ParseFloat(string(x),64)
		if e!=nil || math.IsNaN(f) || math.IsInf(f,0) || math.Abs(f)>=1e21 {
			return "",errors.New("unsupported canonical number")
		}
		f=math.Round(f*1e6)/1e6
		if f==0{return "0",nil}
		return strconv.FormatFloat(f,'f',-1,64),nil
	case int:
		return strconv.Itoa(x),nil
	case int64:
		return strconv.FormatInt(x,10),nil
	case uint64:
		return strconv.FormatUint(x,10),nil
	case float64:
		return canonical(json.Number(strconv.FormatFloat(x,'g',-1,64)))
	case []any:
		out:=make([]string,0,len(x))
		for _,v:=range x{p,e:=canonical(v);if e!=nil{return "",e};out=append(out,p)}
		return "["+strings.Join(out,",")+"]",nil
	case map[string]any:
		keys:=make([]string,0,len(x))
		for k:=range x{keys=append(keys,k)}
		sort.Strings(keys)
		out:=make([]string,0,len(keys))
		for _,k:=range keys{p,e:=canonical(x[k]);if e!=nil{return "",e};out=append(out,quote(k)+":"+p)}
		return "{"+strings.Join(out,",")+"}",nil
	default: return "",fmt.Errorf("unsupported JSON value %T",v)
	}
}

func str(m map[string]any,key string) string {
	s,_:=m[key].(string);return s
}
func obj(v any) map[string]any {m,_:=v.(map[string]any);return m}

func VerifyAuthority(raw []byte, actual Execution, now time.Time,
	trusted map[string]ed25519.PublicKey, replay Replay) Result {
	deny:=func(reason string) Result {return Result{Reason:reason}}
	if replay==nil{return deny("REPLAY_STORE_REQUIRED")}
	env,e:=load(raw);if e!=nil{return deny("INVALID_JSON")}
	sig:=obj(env["signature"])
	kid:=str(env,"keyId")
	pk,ok:=trusted[kid]
	if !ok{return deny("UNTRUSTED_SIGNER")}
	derived,e:=KeyID(pk)
	if e!=nil || derived!=kid{return deny("SIGNER_KEY_ID_MISMATCH")}
	signatureBytes,e:=base64.StdEncoding.Strict().DecodeString(str(sig,"value"))
	if e!=nil || len(signatureBytes)!=ed25519.SignatureSize || str(sig,"alg")!="ed25519" ||
		str(sig,"keyId")!=kid{return deny("SIGNATURE_INVALID")}
	binding:=str(env,"bindingHash")
	delete(env,"signature");delete(env,"signerPublicKey");delete(env,"bindingHash")
	body,e:=canonical(env);if e!=nil{return deny("NONCANONICAL_AUTHORITY")}
	digest:=sha256.Sum256([]byte(body))
	computed:="sha256:"+hex.EncodeToString(digest[:])
	if computed!=binding{return deny("BINDING_HASH_MISMATCH")}
	if !ed25519.Verify(pk,[]byte(binding),signatureBytes){return deny("SIGNATURE_INVALID")}
	if str(env,"type")!="TTPExecutionAuthority"{return deny("INVALID_AUTHORITY_TYPE")}
	from,e:=time.Parse(time.RFC3339Nano,str(env,"issuedAt"))
	if e!=nil{return deny("INVALID_ISSUED_TIME")}
	to,e:=time.Parse(time.RFC3339Nano,str(env,"expiresAt"))
	if e!=nil || now.Before(from) || !now.Before(to) || !to.After(from) {
		return deny("AUTHORITY_EXPIRED_OR_NOT_YET_VALID")
	}
	if actual.Principal!=str(env,"principal") || actual.Action!=str(env,"action") ||
		actual.Target!=str(env,"target"){return deny("EXECUTION_IDENTITY_MISMATCH")}
	material:=obj(env["materialParams"])
	if material==nil{return deny("MISSING_BOUND_PARAMETERS")}
	// All effective parameters must be signed unless a separately verified,
	// signed allowance for nonmaterial fields is implemented.
	actualParams:=actual.Params
	if actualParams==nil{actualParams=map[string]any{}}
	a,e:=canonical(actualParams);if e!=nil{return deny("INVALID_PARAMS")}
	b,e:=canonical(material);if e!=nil || a!=b{return deny("PARAMETER_MISMATCH")}
	nonce:=str(env,"nonce")
	if nonce==""{return deny("MISSING_NONCE")}
	if e:=replay.SpendOnce(nonce);e!=nil{return deny("REPLAYED_OR_UNAVAILABLE")}
	return Result{Allowed:true,Reason:"EXECUTION_ALLOWED",SignerVerified:true,BindingHash:binding}
}

func VerifyReceipt(raw []byte, now time.Time,
	trusted map[string]ed25519.PublicKey, expectedPrior *string) Result {
	deny:=func(reason string)Result{return Result{Reason:reason}}
	r,e:=load(raw);if e!=nil{return deny("INVALID_JSON")}
	signature:=obj(r["signature"])
	kid:=str(r,"keyId")
	key,ok:=trusted[kid];if !ok{return deny("UNTRUSTED_SIGNER")}
	derived,e:=KeyID(key);if e!=nil || derived!=kid{return deny("SIGNER_KEY_ID_MISMATCH")}
	digest:=str(r,"receiptHash")
	sig,e:=base64.StdEncoding.Strict().DecodeString(str(signature,"value"))
	if e!=nil || len(sig)!=ed25519.SignatureSize || str(signature,"alg")!="ed25519" ||
		str(signature,"keyId")!=kid{return deny("SIGNATURE_INVALID")}
	delete(r,"signature");delete(r,"signerPublicKey");delete(r,"receiptHash")
	data,e:=canonical(r);if e!=nil{return deny("NONCANONICAL_RECEIPT")}
	h:=sha256.Sum256([]byte(data))
	expected:="sha256:"+hex.EncodeToString(h[:])
	if expected!=digest{return deny("RECEIPT_HASH_MISMATCH")}
	if !ed25519.Verify(key,[]byte(digest),sig){return deny("SIGNATURE_INVALID")}
	issued,e:=time.Parse(time.RFC3339Nano,str(r,"issuedAt"))
	if e!=nil || issued.After(now){return deny("FUTURE_OR_INVALID_RECEIPT")}
	if expectedPrior!=nil && str(r,"priorReceiptHash")!=*expectedPrior {
		if *expectedPrior!="" || r["priorReceiptHash"]!=nil{return deny("RECEIPT_CHAIN_BROKEN")}
	}
	if executed:=obj(r["executed"]);executed!=nil &&
		str(obj(r["verifier"]),"decision")!="EXECUTION_ALLOWED" {
		return deny("EXECUTED_WITHOUT_AUTHORITY")
	}
	return Result{Allowed:true,Reason:"RECEIPT_VERIFIED",SignerVerified:true,BindingHash:digest}
}
