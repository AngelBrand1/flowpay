from dataclasses import dataclass


@dataclass
class RegisteredWalletSummary:
    id: str
    currency: str
    balance: int


@dataclass
class RegistrationSummary:
    user_id: str
    username: str
    wallet: RegisteredWalletSummary


class RegistrationService:
    def __init__(self, auth_service, wallet_service, ledger_service):
        self.auth_service = auth_service
        self.wallet_service = wallet_service
        self.ledger_service = ledger_service

    def register(self, username: str, password: str) -> RegistrationSummary:
        user_summary = self.auth_service.register(username, password)
        wallet_summary = self.wallet_service.create_wallet(user_summary.id)
        self.ledger_service.record_welcome_bonus(wallet_summary.id)
        balance = self.ledger_service.get_wallet_balance(wallet_summary.id)

        return RegistrationSummary(
            user_id=user_summary.id,
            username=user_summary.username,
            wallet=RegisteredWalletSummary(
                id=wallet_summary.id,
                currency=wallet_summary.currency,
                balance=balance.balance,
            ),
        )
