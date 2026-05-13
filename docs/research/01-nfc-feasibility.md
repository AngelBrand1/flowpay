# NFC Feasibility Research

## Research Goal

Validate whether FlowPay can implement NFC quickly as a beta feature for face-to-face transfers, without making unsupported assumptions.

## Summary

NFC is feasible as a beta transfer initiation feature, but not as true phone-to-phone payment infrastructure.

For the first version, FlowPay should treat NFC as Android-first. iOS support is intentionally deferred to reduce complexity and avoid cross-platform NFC constraints during the initial build.

The practical implementation path is:

- Use NFC to read a short transfer payload from an NFC tag or supported NFC interaction.
- Treat the payload as a way to identify or prefill the transfer recipient.
- Require the sender to review and confirm the transfer in the app.
- Execute the actual money movement through the existing backend transfer flow.

This keeps NFC as a friction-reduction layer, not as the source of financial truth.

## Findings

### React Native support exists

`react-native-nfc-manager` is an established React Native library for NFC on Android and iOS. Its documentation shows support for reading NDEF tags and includes setup steps for both platforms.

Relevant evidence:

- The library has Android and iOS support for `Ndef`.
- Setup requires iOS NFC capability and `NFCReaderUsageDescription`.
- Android requires the `android.permission.NFC` permission.
- The library includes examples for reading and writing NDEF payloads.

Source:

- https://github.com/revtel/react-native-nfc-manager
- https://github.com/revtel/react-native-nfc-manager/wiki/Examples

### Native platform support is tag-oriented

Apple's Core NFC documentation focuses on detecting NFC tags, reading NDEF messages, writing data to tags, and interacting with specific tag protocols.

This supports a tag-based or tag-like initiation model. It does not imply that iOS gives normal apps a simple cross-platform phone-to-phone NFC channel.

Source:

- https://developer.apple.com/documentation/corenfc

### Android phone-to-phone NFC is not a good dependency

Android Beam, the old Android feature for initiating data sharing between devices through NFC, was deprecated in Android 10. Android continues to support other NFC capabilities such as tag reading and payments, but Beam is not actively developed.

Source:

- https://developer.android.com/about/versions/10/behavior-changes-all
- https://developer.android.com/reference/android/nfc/NfcAdapter.CreateBeamUrisCallback

## Recommendation

Implement NFC beta as a transfer initiation mechanism, not as direct phone-to-phone settlement.

Recommended beta flow:

1. Receiver opens a "Receive with NFC" screen.
2. The app exposes or writes a short recipient payload where supported.
3. Sender scans the NFC payload.
4. Sender sees recipient identity and enters amount.
5. Sender confirms explicitly.
6. Backend executes a normal wallet transfer.
7. Transaction history records origin as `nfc`.

## Product Positioning

NFC beta should be presented as a convenience feature for trusted face-to-face transfers.

It should not be described as:

- A bank-grade contactless payment system.
- Offline payment.
- Automatic tap-to-pay.
- A complete security solution.

## Implementation Implications

The NFC payload should contain only non-sensitive routing information, such as:

- recipient wallet public identifier;
- short-lived transfer intent identifier, if backend support exists;
- display name or alias for confirmation.

The payload should not contain:

- password;
- auth token;
- private user data;
- balance;
- executable payment instruction that moves money without confirmation.

## Fastest Viable Build

The fastest reliable implementation is Android-first or tag-based.

For the first build, the safest approach is:

- Build the transfer core normally.
- Add an NFC adapter interface in the mobile app.
- Use `react-native-nfc-manager` for real NFC where available.
- Provide a fallback manual recipient selection for devices without NFC.
- Keep all money movement in the backend.
- Limit the NFC beta to supported Android devices.

## Decision Impact

This research supports keeping NFC as the selected value feature, with the current beta constraints:

- trusted contacts;
- Android-first;
- available only when the required device capabilities are present;
- explicit confirmation;
- no offline payments;
- no automatic payments;
- no independent NFC ledger;
- same transfer rules as manual transfers.
