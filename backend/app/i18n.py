"""Kyrgyz is the source language; Russian is a lookup table. The API sets the
language per request from Accept-Language (see main.LanguageMiddleware)."""

from contextvars import ContextVar

LANGS = ("ky", "ru")
lang_var: ContextVar[str] = ContextVar("lang", default="ky")


def pick_lang(header: str | None) -> str:
    for part in (header or "").split(","):
        code = part.split(";")[0].strip().lower()[:2]
        if code in LANGS:
            return code
    return "ky"


RU: dict[str, str] = {
    "Кирүү талап кылынат": "Требуется вход",
    "Табылган жок": "Не найдено",
    "Бул email катталган": "Этот email уже зарегистрирован",
    "Email же сырсөз туура эмес": "Неверный email или пароль",
    "Бул файл түрү колдоого алынбайт. PDF, DOCX, TXT же MD жүктөңүз.": "Этот тип файла не поддерживается. Загрузите PDF, DOCX, TXT или MD.",
    "Файл өтө чоң (эң көп {mb} МБ)": "Файл слишком большой (максимум {mb} МБ)",
    "Файл бош": "Файл пустой",
    "Документтердин чегине жеттиңиз ({max})": "Достигнут лимит документов ({max})",
    "PDF окулбай калды: {error}": "Не удалось прочитать PDF: {error}",
    "DOCX окулбай калды: {error}": "Не удалось прочитать DOCX: {error}",
    "Документтен текст табылган жок (сканерленген PDF болушу мүмкүн)": "В документе не найден текст (возможно, это скан PDF)",
    "GEMINI_API_KEY коюлган жок": "Не задан GEMINI_API_KEY",
    "Embedding кызматы жооп берген жок: {error}": "Сервис эмбеддингов не ответил: {error}",
    "Embedding кызматы ката берди: {error}": "Сервис эмбеддингов вернул ошибку: {error}",
    "Сервер кайра иштетилди, документ кайра иштетилүүдө": "Сервер перезапущен, документ обрабатывается заново",
    "Даяр документ жок. Адегенде документ жүктөңүз.": "Нет готовых документов. Сначала загрузите документ.",
    "AI ачкычы жок: серверде LLM_API_KEY коюңуз": "Нет ключа AI: задайте LLM_API_KEY на сервере",
    "AI кызматы жооп берген жок: {error}": "AI-сервис не ответил: {error}",
    "AI кызматы ката берди: {error}": "AI-сервис вернул ошибку: {error}",
    "Жаңы маек": "Новый чат",
    "Суроо бош": "Пустой вопрос",
    "Документ али даяр эмес": "Документ ещё не готов",
}


def t(msg: str, **kw) -> str:
    if lang_var.get() == "ru":
        msg = RU.get(msg, msg)
    return msg.format(**kw) if kw else msg
