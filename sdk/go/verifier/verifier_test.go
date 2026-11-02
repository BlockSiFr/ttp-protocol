package verifier

import (
 "crypto/ed25519"
 "crypto/rand"
 "crypto/sha256"
 "encoding/base64"
 "encoding/hex"
 "encoding/json"
 "strings"
 "sync"
 "testing"
 "time"
)

func fixture(t *testing.T) ([]byte,Execution,ed25519.PublicKey,ed25519.PrivateKey,string,time.Time){
 t.Helper()
 pub,priv,e:=ed25519.GenerateKey(rand.Reader);if e!=nil{t.Fatal(e)}
 kid,e:=KeyID(pub);if e!=nil{t.Fatal(e)}
 now:=time.Date(2026,11,2,22,0,0,0,time.UTC)
 m:=map[string]any{
  "type":"TTPExecutionAuthority","version":1,
  "principal":"user:test","delegator":nil,"session":nil,
  "action":"payments.transfer","target":"acct:1",
  "materialParams":map[string]any{"amount":100},"constraints":map[string]any{},
  "policyVersion":"test-v1","consequence":"MONEY_MOVED",
  "routeId":nil,"routeHash":nil,
  "issuedAt":now.Add(-time.Minute).Format(time.RFC3339),
  "expiresAt":now.Add(time.Minute).Format(time.RFC3339),
  "nonce":"synthetic-unique-nonce","keyId":kid,
 }
 body,e:=canonical(m);if e!=nil{t.Fatal(e)}
 hash:=sha256.Sum256([]byte(body))
 binding:="sha256:"+hex.EncodeToString(hash[:])
 m["bindingHash"]=binding
 m["signature"]=map[string]any{"alg":"ed25519","keyId":kid,
  "value":base64.StdEncoding.EncodeToString(ed25519.Sign(priv,[]byte(binding)))}
 m["signerPublicKey"]="UNTRUSTED-EMBEDDED-KEY-NOT-USED"
 raw,e:=json.Marshal(m);if e!=nil{t.Fatal(e)}
 return raw,Execution{Principal:"user:test",Action:"payments.transfer",Target:"acct:1",Params:map[string]any{"amount":100}},pub,priv,kid,now
}
func TestPinnedKeyAndExactExecution(t *testing.T){
 raw,exec,key,_,kid,now:=fixture(t)
 trusted:=map[string]ed25519.PublicKey{kid:key}
 first:=VerifyAuthority(raw,exec,now,trusted,NewMemoryReplay())
 if !first.Allowed || !first.SignerVerified{t.Fatalf("want verified allow, got %+v",first)}
 second:=VerifyAuthority(raw,exec,now,trusted,NewMemoryReplay())
 if !second.Allowed{t.Fatalf("separate fixture ledger expected fresh: %+v",second)}
 ledger:=NewMemoryReplay()
 if !VerifyAuthority(raw,exec,now,trusted,ledger).Allowed{t.Fatal("first nonce use must succeed")}
 if r:=VerifyAuthority(raw,exec,now,trusted,ledger);r.Allowed || r.Reason!="REPLAYED_OR_UNAVAILABLE"{t.Fatalf("replay accepted %+v",r)}
 if r:=VerifyAuthority(raw,exec,now,nil,NewMemoryReplay());r.Allowed{t.Fatal("untrusted signer permitted")}
 if r:=VerifyAuthority(raw,exec,now,trusted,nil);r.Allowed{t.Fatal("missing durable replay interface permitted")}
}
func TestChangedParametersAndExpiryDeny(t *testing.T){
 raw,exec,pub,_,kid,now:=fixture(t)
 trusted:=map[string]ed25519.PublicKey{kid:pub}
 exec.Params["amount"]=50000
 if r:=VerifyAuthority(raw,exec,now,trusted,NewMemoryReplay());r.Allowed || r.Reason!="PARAMETER_MISMATCH"{t.Fatalf("parameters %+v",r)}
 exec.Params=map[string]any{"amount":100,"extra":"delete"}
 if r:=VerifyAuthority(raw,exec,now,trusted,NewMemoryReplay());r.Allowed{t.Fatal("unbound extra parameter")}
 exec.Params=map[string]any{"amount":100}
 if r:=VerifyAuthority(raw,exec,now.Add(2*time.Minute),trusted,NewMemoryReplay());r.Allowed{t.Fatal("expired authority")}
 exec.Target="acct:wrong"
 if r:=VerifyAuthority(raw,exec,now,trusted,NewMemoryReplay());r.Allowed{t.Fatal("changed target")}
}
func TestForgedSelfAssertedKeyIdDenied(t *testing.T){
 raw,exec,_,_,kid,now:=fixture(t)
 otherPub,_,_:=ed25519.GenerateKey(rand.Reader)
 if r:=VerifyAuthority(raw,exec,now,map[string]ed25519.PublicKey{kid:otherPub},NewMemoryReplay());r.Allowed || r.Reason!="SIGNER_KEY_ID_MISMATCH"{t.Fatalf("spoof %+v",r)}
}
func TestTamperedEnvelopeAndFutureTimeDenied(t *testing.T){
 raw,exec,pub,_,kid,now:=fixture(t)
 var m map[string]any
 if e:=json.Unmarshal(raw,&m);e!=nil{t.Fatal(e)}
 m["consequence"]="NONE"
 mutated,_:=json.Marshal(m)
 if r:=VerifyAuthority(mutated,exec,now,map[string]ed25519.PublicKey{kid:pub},NewMemoryReplay());r.Allowed{t.Fatal("forged consequence")}
 if r:=VerifyAuthority(raw,exec,now.Add(-2*time.Minute),map[string]ed25519.PublicKey{kid:pub},NewMemoryReplay());r.Allowed{t.Fatal("future authority")}
}
func TestReceiptSignerAndCausalBinding(t *testing.T){
 _,_,pub,priv,kid,now:=fixture(t)
 r:=map[string]any{
   "type":"PCTRExecutionReceipt","version":1,"receiptId":"rcpt-test",
   "requested":map[string]any{"action":"payments.transfer","target":"acct:1","params":map[string]any{"amount":100}},
   "requestedBy":"agent","principal":"user:test","delegator":nil,
   "routeSelected":nil,"consequence":nil,"authorityBound":nil,
   "verifier":map[string]any{"decision":"EXECUTION_ALLOWED","failures":[]any{},"signerVerified":true},
   "executed":map[string]any{"status":"SUCCEEDED","output":"settled","executedAt":now.Format(time.RFC3339)},
   "policyVersion":"test-v1","issuedAt":now.Format(time.RFC3339),
   "priorReceiptHash":nil,"keyId":kid,
 }
 canon,e:=canonical(r);if e!=nil{t.Fatal(e)}
 hash:=sha256.Sum256([]byte(canon));digest:="sha256:"+hex.EncodeToString(hash[:])
 r["receiptHash"]=digest
 r["signature"]=map[string]any{"alg":"ed25519","keyId":kid,
  "value":base64.StdEncoding.EncodeToString(ed25519.Sign(priv,[]byte(digest)))}
 r["signerPublicKey"]="CALLER-ASSERTED"
 data,_:=json.Marshal(r)
 trusted:=map[string]ed25519.PublicKey{kid:pub}
 if result:=VerifyReceipt(data,now,trusted,nil);!result.Allowed{t.Fatalf("receipt rejected %+v",result)}
 if result:=VerifyReceipt(data,now,nil,nil);result.Allowed{t.Fatal("untrusted receipt")}
 wrong:="sha256:bad"
 if result:=VerifyReceipt(data,now,trusted,&wrong);result.Allowed{t.Fatal("broken prior chain")}
 r["executed"]=map[string]any{"status":"SUCCEEDED"}
 altered,_:=json.Marshal(r)
 if result:=VerifyReceipt(altered,now,trusted,nil);result.Allowed{t.Fatal("modified receipt")}
}
func TestReplayConcurrency(t *testing.T){
 ledger:=NewMemoryReplay()
 var wg sync.WaitGroup
 successes:=make(chan bool,30)
 for i:=0;i<30;i++{wg.Add(1);go func(){defer wg.Done();successes<-ledger.SpendOnce("one-nonce")==nil}()}
 wg.Wait();close(successes)
 n:=0;for v:=range successes{if v{n++}}
 if n!=1{t.Fatalf("atomic replay expected one success, got %d",n)}
}
func TestCanonicalNumberAndString(t *testing.T){
 m:=map[string]any{"b":json.Number("1.200000001"),"a":"<trusted>"}
 v,e:=canonical(m);if e!=nil{t.Fatal(e)}
 if v!="{\"a\":\"<trusted>\",\"b\":1.2}"{t.Fatalf("canonical mismatch %s",v)}
 if _,e=canonical(json.Number("1e999"));e==nil{t.Fatal("infinite value accepted")}
 if _,e=canonical(map[string]any{"bad":strings.Repeat("a",1)});e!=nil{t.Fatal(e)}
}
