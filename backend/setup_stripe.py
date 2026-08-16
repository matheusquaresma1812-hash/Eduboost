"""Idempotent setup of Stripe products and prices for EduBoost Pro (BRL)."""
import os
import stripe
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")
stripe.api_key = os.environ["STRIPE_SECRET_KEY"]

CATALOG = [
    {
        "emergent_product_id": "eduboost_estudante_pro",
        "name": "EduBoost Estudante Pro",
        "description": "Feynman ilimitado, Central de estudos completa, Correção de redação por foto e Duelos.",
        "tax_code": "txcd_10103001",  # SaaS
        "prices": [
            {"lookup_key": "estudante_pro_monthly", "amount": 1990, "currency": "brl", "interval": "month"},
        ],
    },
    {
        "emergent_product_id": "eduboost_vestibulando",
        "name": "EduBoost Vestibulando",
        "description": "Tudo do Estudante Pro + prioridade na IA, correção de discursivas e mapa mental sem limite.",
        "tax_code": "txcd_10103001",
        "prices": [
            {"lookup_key": "vestibulando_monthly", "amount": 3990, "currency": "brl", "interval": "month"},
        ],
    },
]


def get_or_create_product(entry):
    for p in stripe.Product.list(active=True, limit=100).auto_paging_iter():
        meta = (p.to_dict().get("metadata") or {})
        if meta.get("emergent_product_id") == entry["emergent_product_id"]:
            # keep description in sync
            if p.description != entry["description"]:
                stripe.Product.modify(p.id, description=entry["description"])
            return stripe.Product.retrieve(p.id)
    return stripe.Product.create(
        name=entry["name"],
        description=entry["description"],
        tax_code=entry.get("tax_code"),
        metadata={"managed_by": "emergent", "emergent_product_id": entry["emergent_product_id"]},
    )


def sync_price(product_id, spec):
    existing = stripe.Price.list(lookup_keys=[spec["lookup_key"]], active=True, limit=1).data
    if existing:
        e = existing[0]
        if e.unit_amount != spec["amount"] or e.currency != spec["currency"]:
            stripe.Price.modify(e.id, active=False)
            existing = []
        else:
            return e
    kwargs = dict(
        product=product_id,
        unit_amount=spec["amount"],
        currency=spec["currency"],
        lookup_key=spec["lookup_key"],
        transfer_lookup_key=True,
    )
    if spec.get("interval"):
        kwargs["recurring"] = {"interval": spec["interval"]}
    return stripe.Price.create(**kwargs)


def main():
    for entry in CATALOG:
        product = get_or_create_product(entry)
        print(f"OK product: {product.name} ({product.id})")
        for spec in entry["prices"]:
            price = sync_price(product.id, spec)
            print(f"   ↳ price {spec['lookup_key']}: {price.id} — {price.unit_amount/100:.2f} {price.currency.upper()}/{spec.get('interval','once')}")


if __name__ == "__main__":
    main()
