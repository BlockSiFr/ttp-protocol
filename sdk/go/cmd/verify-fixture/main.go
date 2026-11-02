// Command verify-fixture checks Node-issued PCTR objects in an independent Go
// process. TEST HARNESS ONLY: trustedKeyPem is supplied by the caller, so this
// CLI is not itself a production trusted-key provisioning mechanism.
package main

import (
 "crypto/ed25519"
 "crypto/x509"
 "encoding/json"
 "encoding/pem"
 "fmt"
 "io"
 "os"
 "time"

 "github.com/BlockSiFr/ttp-protocol/sdk/go/verifier"
)

type fixture struct {
 Mode string `json:"mode"`
 Authority json.RawMessage `json:"authority"`
 Receipt json.RawMessage `json:"receipt"`
 Execution verifier.Execution `json:"execution"`
 Now string `json:"now"`
 TrustedKeyPEM string `json:"trustedKeyPem"`
}
func main(){
 blob,e:=io.ReadAll(io.LimitReader(os.Stdin,1<<20))
 if e!=nil{panic(e)}
 var in fixture
 if e:=json.Unmarshal(blob,&in);e!=nil{panic(e)}
 block,_:=pem.Decode([]byte(in.TrustedKeyPEM))
 if block==nil{panic("missing pinned fixture PEM")}
 obj,e:=x509.ParsePKIXPublicKey(block.Bytes)
 if e!=nil{panic(e)}
 pub,ok:=obj.(ed25519.PublicKey)
 if !ok{panic("Ed25519 only")}
 kid,e:=verifier.KeyID(pub)
 if e!=nil{panic(e)}
 now,e:=time.Parse(time.RFC3339Nano,in.Now)
 if e!=nil{panic(e)}
 trust:=map[string]ed25519.PublicKey{kid:pub}
 var result verifier.Result
 switch in.Mode{
 case "authority":
  result=verifier.VerifyAuthority(in.Authority,in.Execution,now,trust,verifier.NewMemoryReplay())
 case "receipt":
  result=verifier.VerifyReceipt(in.Receipt,now,trust,nil)
 default:panic("unknown verifier test mode")
 }
 data,e:=json.Marshal(result);if e!=nil{panic(e)}
 fmt.Println(string(data))
}
