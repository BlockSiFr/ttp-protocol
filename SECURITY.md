# Security Policy

TTP is security-critical infrastructure, and I take its security seriously.

If you discover a vulnerability or weakness, please reach out directly.  
Responsible disclosure and external review are welcome and appreciated.

---

## Reporting Vulnerabilities

Please report suspected vulnerabilities privately via email:

maurice@blocksifr.com

Include where possible:

- Description of the issue  
- Reproduction steps or proof of concept  
- Affected components or versions  
- Potential impact or exploitation scenario  

Please do not open public issues for security vulnerabilities.

---

## Scope

Security-sensitive areas include, but are not limited to:

- Trust token validation  
- Cryptographic signature handling  
- Aggregation logic integrity  
- Receipt replay protection  
- Issuer trust and federation assumptions  
- SDK token lifecycle handling  
- Verifier policy enforcement boundaries  

Out-of-scope items may include feature requests or documentation issues unless they introduce security risk.

---

## Response Process

I aim to:

- Acknowledge reports within 48 hours  
- Assess severity and impact  
- Coordinate responsible disclosure  
- Release fixes or mitigations promptly  
- Credit reporters when appropriate  

Timelines may vary depending on complexity and ecosystem impact.

---

## Disclosure Philosophy

TTP follows coordinated disclosure practices prioritizing ecosystem safety and transparency.

External review, critique, and academic analysis are encouraged.  
Security findings are viewed as contributions to the protocol’s maturity.

---

## Security Design Principles

TTP development is guided by:

- Minimize state  
- Minimize credential lifetime  
- Cryptographic verification of assertions  
- Explicit trust boundaries  
- Defense in depth  
- Adversarial mindset by default  

No system is assumed secure by design alone — scrutiny and iteration are expected.

---

## Safe Harbor

Good-faith research conducted responsibly and ethically is supported.  
Researchers acting without malicious intent and avoiding harm will not face punitive action for disclosure.

---

Thank you for helping strengthen the security posture of the TTP ecosystem.