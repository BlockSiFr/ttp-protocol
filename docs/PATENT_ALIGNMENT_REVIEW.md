# TTP Patent and Open-Protocol Rights Review

**Status: legal hold for independent counsel review, not an IP opinion.**

BlockSiFr LLC's commercial rights are understood to include a contemplated or stated **exclusive license from Interrupt21 LLC** for the cross-industry adaptive-access patent family. Confirm ownership, license execution, sublicensing rights and exact patent claims before final public assertions.

## Potentially material conflict

The current repository NOTICE (Apache-2.0) states a royalty-free patent grant for patents **held by BlockSiFr** necessarily infringed by protocol implementations, plus additional broad promises about the protocol's future. That text does **not** by itself demonstrate that BlockSiFr **owns** Interrupt21's patents or is empowered to sublicense all applicable claims under the exclusive license.

Do not interpret or rewrite the existing legal grant retroactively through this engineering PR. Do not claim all implementation features are protected by the patent or that the filed application covers new TTP features.

## Counsel decisions required

1. Map normative TTP claims/algorithms, PCTR consequences, execution receipts, trust routing, and Go/JS/Python implementations to the filed patent claims, with code and test references.
2. Confirm which licensed patent rights Interrupt21 actually granted BlockSiFr, including sublicensing and sublicenses under Apache-2.0.
3. Reconcile the NOTICE grant and promise not to encumber the specification with the exclusive agreement, third-party contributors, and required patent-defense terms.
4. Identify novel TTP inventions not clearly supported by the existing filing; flag before public claims, and decide any separate IP filing.
5. Validate Apache-2.0 rights and trademark policy independently. Do not unilaterally narrow existing license grants.
6. Preserve independent standards conformance and open protocol interoperability without implying external certification.

**Blocker:** Named counsel must formally approve the precise patent-to-code matrix and any revised public legal language. This cannot be completed through code review alone.
