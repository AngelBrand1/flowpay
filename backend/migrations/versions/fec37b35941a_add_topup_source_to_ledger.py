"""add_topup_source_to_ledger

Revision ID: fec37b35941a
Revises: d2aff0e6e0ab
Create Date: 2026-05-15 17:09:50.723355

"""

revision = 'fec37b35941a'
down_revision = 'd2aff0e6e0ab'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.drop_constraint('ck_ledger_transactions_source', 'ledger_transactions')
    op.drop_constraint('ck_ledger_transactions_type_source', 'ledger_transactions')
    op.drop_constraint('ck_ledger_transactions_operation_reference', 'ledger_transactions')

    op.create_check_constraint(
        'ck_ledger_transactions_source',
        'ledger_transactions',
        "source IN ('welcome_bonus', 'manual_transfer', 'nfc_transfer', 'topup')",
    )
    op.create_check_constraint(
        'ck_ledger_transactions_type_source',
        'ledger_transactions',
        "(type = 'credit' AND source IN ('welcome_bonus', 'manual_transfer', 'nfc_transfer', 'topup')) "
        "OR (type = 'debit' AND source IN ('manual_transfer', 'nfc_transfer'))",
    )
    op.create_check_constraint(
        'ck_ledger_transactions_operation_reference',
        'ledger_transactions',
        "(source IN ('welcome_bonus', 'topup') AND operation_id IS NULL) "
        "OR (source IN ('manual_transfer', 'nfc_transfer') AND operation_id IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint('ck_ledger_transactions_source', 'ledger_transactions')
    op.drop_constraint('ck_ledger_transactions_type_source', 'ledger_transactions')
    op.drop_constraint('ck_ledger_transactions_operation_reference', 'ledger_transactions')

    op.create_check_constraint(
        'ck_ledger_transactions_source',
        'ledger_transactions',
        "source IN ('welcome_bonus', 'manual_transfer', 'nfc_transfer')",
    )
    op.create_check_constraint(
        'ck_ledger_transactions_type_source',
        'ledger_transactions',
        "(type = 'credit' AND source IN ('welcome_bonus', 'manual_transfer', 'nfc_transfer')) "
        "OR (type = 'debit' AND source IN ('manual_transfer', 'nfc_transfer'))",
    )
    op.create_check_constraint(
        'ck_ledger_transactions_operation_reference',
        'ledger_transactions',
        "(source = 'welcome_bonus' AND operation_id IS NULL) "
        "OR (source IN ('manual_transfer', 'nfc_transfer') AND operation_id IS NOT NULL)",
    )
