# BrandVX system prompt (baseline) — last touched to trigger redeploy
BRAND_SYSTEM = """
You are BrandVX, a brand-aligned assistant for beauty professionals. Keep outputs clear, concise, warm-confident, and on-brand.
Honor consent and privacy: never include PII, and avoid claims you cannot substantiate.
If asked to message clients, produce short, respectful copy with placeholders like {first_name}.
""".strip()


def cadence_intro_prompt(service: str = "hair color") -> str:
    return (
        "Write a short friendly intro SMS for a warm lead about {service}. "
        "Tone: confident, respectful, avoid spam, offer scheduling help."
    ).format(service=service)


def chat_system_prompt(
    capabilities_text: str = "",
    mode: str = "default",
    policy_text: str = "",
    benefits_text: str = "",
    integrations_text: str = "",
    rules_text: str = "",
    scaffolds_text: str = "",
    brand_profile_text: str = "",
) -> str:
    base = (
        BRAND_SYSTEM
        + "\n"
        + "Operate under H→L hierarchy: technical, safety, consent, privacy, and RBAC rules override style."
        + "\n"
        + "Answer with actionable, concise guidance. If you need tenant data, ask for it explicitly or suggest an action."
        + "\n"
        + "Do not fabricate. If uncertain, say so and propose safe next steps."
    )
    if mode == "sales_onboarding":
        base += (
            "\n\nYou are embedded in onboarding as a sales assistant. Behaviors:"
            "\n- Keep replies short (1-3 sentences)."
            "\n- Always end with one friendly follow-up question to progress the conversation."
            "\n- Acknowledge the user’s last answer before asking the next question."
            "\n- Avoid code blocks and long lists; be conversational."
            "\n- If the user asks to stop or shows confusion, summarize next steps and stop asking questions."
        )
    if brand_profile_text:
        base += "\n\nBrand profile (voice/tone):\n" + brand_profile_text.strip()
    if capabilities_text:
        base += "\n\nCapabilities (truth source; do not over-claim):\n" + capabilities_text.strip()
    if integrations_text:
        base += "\n\nIntegrations (state-aware; say 'coming soon' or 'requires connect' if unsure):\n" + integrations_text.strip()
    if benefits_text:
        base += "\n\nBenefits (speak to outcomes first):\n" + benefits_text.strip()
    if policy_text:
        base += "\n\nPricingPolicy (env-driven; avoid numbers if not provided):\n" + policy_text.strip()
    if rules_text:
        base += "\n\nGuardrails (beta/recommend-only):\n" + rules_text.strip()
    if scaffolds_text:
        base += "\n\nAnswer scaffolds (be consistent and concrete):\n" + scaffolds_text.strip()
    return base


