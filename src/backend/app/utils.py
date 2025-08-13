import phonenumbers


def normalize_phone(raw: str) -> str:
    try:
        num = phonenumbers.parse(raw, "US")
        if not phonenumbers.is_valid_number(num):
            return raw
        return phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.E164)
    except Exception:
        return raw


