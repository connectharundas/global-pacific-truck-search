import re

LOADED_TAB = "LOADED"


def normalize(value):

    value = str(value).upper().strip()

    value = value.replace(" ", "")

    # Remove leading hyphen
    value = re.sub(r"^-+", "", value)

    # Remove trailing hyphen
    value = re.sub(r"-+$", "", value)

    return value


def get_match_type(keyword, value):

    keyword = normalize(keyword)

    value = normalize(value)

    if keyword == value:
        return "exact"

    if keyword in value:
        return "partial"

    return None


def date_only(value):

    return str(value).strip().split(" ")[0]


def clean_columns(columns):
    return (
        columns
        .str.replace("\n", " ", regex=False)
        .str.replace("\r", " ", regex=False)
        .str.strip()
    )
