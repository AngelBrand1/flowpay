# Main Feature Selection

## Decision

The main feature on top of the wallet will be NFC-assisted face-to-face transfer.

NFC adds value because it reduces friction in a common real-world scenario: two people are physically together and one wants to transfer money to the other without searching for a username, typing identifiers, or sharing data manually.

## Reasoning

FlowPay must already allow direct transfers between wallets. NFC does not change the financial nature of the operation; it changes how it is initiated.

Instead of building a completely new flow, NFC should act as a convenience layer on top of the existing transfer:

- The receiver presents an NFC identifier supported by the device or an NFC tag.
- The sender scans that payload from the app.
- The app identifies the receiver or prepares the transfer context.
- The sender reviews amount and receiver.
- The sender confirms explicitly.
- The transfer executes using the same wallet core rules.

This keeps the focus on money integrity and avoids NFC becoming a parallel system.

The first version will be Android-first. iOS support is not considered initially because it increases complexity and is not necessary to validate the feature’s value.

## Initial Scope

The first version of NFC will be beta.

It must support:

- Initiating a face-to-face transfer via NFC.
- Explicit sender confirmation before moving money.
- Use of the same balance, transaction, and auditability rules as a normal transfer.
- Recording the origin of the operation as an NFC-initiated transfer.
- Manual fallback when the device does not support NFC.
- Availability of the NFC flow only when both devices support the required use case.

It must not initially support:

- Automatic payments without user confirmation.
- Transfers to strangers without visual review of the receiver.
- Advanced device-to-device security.
- Complete prevention of physical or relay attacks.
- Offline operation.
- Guarantees equivalent to a bank contactless payment system.
- Universal phone-to-phone communication between iOS and Android.
- iOS support in the first version.

## Usage Restriction

While NFC is in beta, the product should present it as a recommended option only for transfers with trusted people.

The user must be able to visually verify who they are sending money to before confirming.

## Relationship with the Core

NFC does not introduce new money movements.

An NFC-initiated transfer still generates:

- A debit in the source wallet.
- A credit in the destination wallet.
- A common operation reference.
- An auditable history.

The difference from a manual transfer is the channel used to start the operation.

## Risks

- Higher technical complexity than other value features.
- Dependence on device capabilities.
- Differences between mobile platforms.
- Limitations of phone-to-phone NFC on modern mobile platforms.
- Security risks if transfer is allowed without clear confirmation.
- Risk of overreach if trying to build full banking security from the first version.

## Mitigations

- Keep NFC as beta.
- Limit the first version to Android.
- Enable NFC only if the device supports the required flow.
- Require explicit confirmation before moving money.
- Reuse the existing transactional flow.
- Record that the operation was initiated by NFC.
- Limit feature positioning to trusted people.
- Leave advanced security for future evolution.

## Success Criterion

The feature is successful if it enables initiating a face-to-face transfer with less friction than the manual flow, without weakening the rules of money integrity.
