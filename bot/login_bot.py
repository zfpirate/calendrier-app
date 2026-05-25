import argparse
import os
import re
import json
import unicodedata
import time
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urlencode
from typing import Any, Dict, Iterable, List, Optional, Tuple

# Configuration du logger
from logger import setup_logger, get_logger

# Initialisation du logger
logger = get_logger('bot.login')
info = logger.info
debug = logger.debug
warning = logger.warning
error = logger.error
critical = logger.critical
exception = logger.exception

from playwright.sync_api import (
    Page,
    Playwright,
    Locator,
    TimeoutError as PlaywrightTimeoutError,
    sync_playwright,
)

debug(f"Fichier chargé: {__file__}")

PORTAL_URL = "https://armeco.ecoleenligne.be"
APP_URL_ENV = "APP_URL"
TARGET_AGENDA_URL = (
    "https://www2.ecoleenligne.be/V01154-3/addons/agenda/"
    "index.php?action=agenda&opt=-1&id=-1&item=-1&order=asc&etp=armeco"
)
CALENDAR_PAGE_URL = "https://www2.ecoleenligne.be/V01154-3/addons/calendrier/index.php?action=liste&opt=-1&id=-1&order=desc&etp=armeco"
CALENDAR_EVENTS_URL = "https://www2.ecoleenligne.be/V01154-3/addons/calendrier/event_agenda.php"
USERNAME_ENV = "EEL_USERNAME"
PASSWORD_ENV = "EEL_PASSWORD"
DEFAULT_SERVICE_ACCOUNT = Path(__file__).resolve().parent / "firebase-service-account.json"
DEFAULT_FIRESTORE_COLLECTION = "users"
DEFAULT_FIRESTORE_USER_FIELD = "ecoleUser"
DEFAULT_FIRESTORE_PASS_FIELD = "ecolePass"
ENCRYPTION_VERSION = "v1"
DEFAULT_USERNAME = "hello world"
DEFAULT_PASSWORD = "bye world"
FIRESTORE_MODULE: Any = None
ENABLE_HIGHLIGHT = False
# Configuration constants with environment fallback
SHORT_PAUSE_MS = int(os.environ.get("BOT_SHORT_PAUSE_MS", "500"))
LOGIN_NAV_TIMEOUT_MS = int(os.environ.get("BOT_LOGIN_TIMEOUT_MS", "30000"))
MAX_CHECKBOX_CLICKS = int(os.environ.get("BOT_MAX_CHECKBOX_CLICKS", "30"))

OFF_TYPE_LABELS = {
    "vacances": "Vacances",
    "pas_cours": "Pas de cours/Congé",
}

MONTH_MAP_FR = {
    "janvier": 1,
    "fevrier": 2,
    "février": 2,
    "mars": 3,
    "avril": 4,
    "mai": 5,
    "juin": 6,
    "juillet": 7,
    "aout": 8,
    "août": 8,
    "septembre": 9,
    "octobre": 10,
    "novembre": 11,
    "decembre": 12,
    "décembre": 12,
}

OFF_KEYWORD_MAP = {
    "vacances": "vacances",
    "vacance": "vacances",
    "conge": "pas_cours",
    "conge armistice": "pas_cours",
    "cong armistice": "pas_cours",
    "cours suspend": "pas_cours",
    "pas de cours": "pas_cours",
    "journee pedagogique": "pas_cours",
    "journee pedagogiques": "pas_cours",
    "journee pedagogique reseau": "pas_cours",
    "journee pedagogique district": "pas_cours",
    "journee pedagogique": "pas_cours",
}

# Ensure Playwright browsers are stored locally in the project, independent of user profiles
try:
    PROJECT_ROOT = Path(__file__).resolve().parents[1]
    os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", str(PROJECT_ROOT / "playwright-browsers"))
except Exception:
    pass


def _attach_console_logging(page: Page, label: str = "page") -> None:
    """Attach console logging to the page with proper log levels.
    
    Args:
        page: Instance de la page Playwright
        label: Étiquette pour identifier la source des logs
    """
    def console_handler(msg):
        try:
            # Récupération du type de message
            try:
                msg_type = msg.type.upper()
            except Exception:
                msg_type = "LOG"
                
            # Récupération du texte du message
            try:
                message = msg.text
            except Exception:
                message = str(msg)
                
            # Formatage du message
            log_message = f"{label} console: {message}"
            
            # Envoi au logger approprié selon le type de message
            if msg_type == "ERROR":
                logger.error(log_message)
            elif msg_type == "WARNING":
                logger.warning(log_message)
            elif msg_type in ["LOG", "INFO"]:
                logger.info(log_message)
            elif msg_type == "DEBUG":
                logger.debug(log_message)
            else:
                logger.info(f"{label} console.{msg_type}: {message}")
                
        except Exception as e:
            logger.error(f"Error in console handler: {e}", exc_info=True)
    
    try:
        page.on("console", console_handler)
        logger.debug(f"Console logging attached to page: {label}")
    except Exception as e:
        logger.error(f"Failed to attach console logging: {e}", exc_info=True)


def _short_pause(page: Optional[Page] = None, ms: Optional[int] = None) -> None:
    """Pause l'exécution pour une durée donnée.
    
    Args:
        page: Instance de la page Playwright (optionnel)
        ms: Durée de la pause en millisecondes
    """
    try:
        if ms is None:
            ms = SHORT_PAUSE_MS
            
        logger.debug(f"Pause de {ms}ms")
        
        if page is not None:
            page.wait_for_timeout(ms)
        else:
            time.sleep(ms / 1000.0)
            
    except Exception as exc:
        logger.error(f"Erreur lors de la pause: {exc}", exc_info=True)
        # Relancer l'exception pour ne pas masquer les erreurs
        raise


def _normalize_text(value: str) -> str:
    txt = value or ""
    txt = unicodedata.normalize("NFKD", txt)
    txt = txt.encode("ASCII", "ignore").decode("ASCII", "ignore")
    return txt.lower().strip()


def _normalize_keyword(value: str) -> str:
    return re.sub(r"\s+", " ", _normalize_text(value))


def _match_off_type(title: str) -> Optional[str]:
    normalized = _normalize_keyword(title)
    for key, off_type in OFF_KEYWORD_MAP.items():
        if key in normalized:
            return off_type
    return None


def _parse_iso_date(value: str) -> Optional[datetime]:
    try:
        if value:
            return datetime.fromisoformat(value[:10])
    except Exception:
        return None
    return None


def _parse_ddmmyyyy(value: str) -> Optional[datetime]:
    if not value:
        return None
    match = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", value.strip())
    if not match:
        return None
    day, month, year = map(int, match.groups())
    try:
        return datetime(year, month, day)
    except ValueError:
        return None


def _parse_french_text_date(value: str) -> Optional[datetime]:
    if not value:
        return None
    cleaned = _normalize_text(value)
    # Gérer les formats comme "Mardi 25 Novembre 2025"
    match = re.search(r"(\d{1,2})\s+([a-z]+)\s+(\d{4})", cleaned)
    if not match:
        return None
    day = int(match.group(1))
    month_key = match.group(2)
    year = int(match.group(3))
    month = MONTH_MAP_FR.get(month_key)
    if not month:
        return None
    try:
        return datetime(year, month, day)
    except ValueError:
        return None


def _extract_date_for_sort(item: dict) -> Optional[datetime]:
    candidates = [
        item.get("modalDate"),
        item.get("dueHeading"),
        item.get("assignedDate"),
    ]
    for raw in candidates:
        if not raw:
            continue
        for parser in (_parse_iso_date, _parse_ddmmyyyy, _parse_french_text_date):
            dt = parser(str(raw))
            if dt:
                return dt
    return None


def _item_sort_key(item: dict) -> Tuple[float, str, str]:
    dt = _extract_date_for_sort(item)
    timestamp = dt.timestamp() if dt else float("inf")
    title = str(item.get("title") or item.get("modalTitle") or "")
    event_id = str(item.get("eventId") or "")
    return (timestamp, title.lower(), event_id)


def _fetch_calendar_events(page: Page, start: datetime, end: datetime) -> List[dict]:
    params = {
        "action": "liste",
        "opt": "-1",
        "id": "-1",
        "etp": "armeco",
        "start": start.strftime("%Y-%m-%d"),
        "end": end.strftime("%Y-%m-%d"),
        "_": int(time.time() * 1000),
    }

    query = urlencode(params)
    url = f"{CALENDAR_EVENTS_URL}?{query}"

    js = """
        async (url) => {
            if (!window.fetch) {
                return { error: 'fetch_missing' };
            }
            try {
                const resp = await fetch(url, {
                    headers: {
                        'Accept': 'application/json, text/javascript, */*; q=0.01',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'include'
                });
                const status = resp.status;
                const text = await resp.text();
                return { status, text };
            } catch (err) {
                return { error: String(err) };
            }
        }
    """

    try:
        result = page.evaluate(js, url)
    except Exception as exc:
        print(f"[bot] JS fetch calendrier échoué: {exc}")
        return []

    if not isinstance(result, dict):
        print(f"[bot] Resultat fetch calendrier inattendu: {result}")
        return []

    if result.get("error"):
        print(f"[bot] Erreur fetch calendrier: {result['error']}")
        return []

    status = result.get("status")
    raw_text = result.get("text", "")
    if status != 200:
        preview = raw_text[:120]
        print(f"[bot] Statut calendrier {status}, extrait: {preview}")
        return []

    try:
        payload = json.loads(raw_text)
    except Exception:
        preview = raw_text[:120]
        print(f"[bot] Reponse calendrier non JSON valide (extrait: {preview})")
        return []

    if isinstance(payload, list):
        print(f"[bot] Calendrier JSON recu (taille brute): {len(payload)}")
        return payload
    if isinstance(payload, dict):
        events = payload.get("events")
        if isinstance(events, list):
            print(f"[bot] Calendrier JSON recu (events): {len(events)}")
            return events
    print(f"[bot] Payload calendrier inattendu: {type(payload).__name__}")
    return []


def _extract_off_days_from_events(events: Iterable[dict]) -> List[dict]:
    dedupe = set()
    off_items: List[dict] = []
    for ev in events:
        title = str(ev.get("title") or "").strip()
        if not title:
            continue
        off_type = _match_off_type(title)
        if not off_type:
            continue
        start_raw = ev.get("start") or ev.get("startDate")
        end_raw = ev.get("end") or ev.get("endDate") or start_raw
        if not start_raw:
            continue
        try:
            start_dt = datetime.fromisoformat(start_raw[:19])
        except Exception:
            continue
        if end_raw:
            try:
                end_dt = datetime.fromisoformat(end_raw[:19])
            except Exception:
                end_dt = start_dt
        else:
            end_dt = start_dt

        date = start_dt.date().isoformat()
        key = (date, off_type)
        if key in dedupe:
            continue
        dedupe.add(key)

        off_items.append({
            "date": date,
            "type": off_type,
            "title": title,
            "start": start_dt,
            "end": end_dt,
        })
    return off_items


def _off_day_to_homework(off_item: dict) -> dict:
    off_type = off_item.get("type") or "vacances"
    label = OFF_TYPE_LABELS.get(off_type, off_type)
    title = str(off_item.get("title") or label)
    date = off_item.get("date")

    return {
        "eventId": f"off_{off_type}_{date}",
        "subject": label,
        "labels": [label],
        "title": title,
        "assignedDate": date,
        "dueHeading": date,
        "source": "off_days",
        "modalDetail": title,
        "modalMeta": [label],
        "modalRawText": title,
        "modalHtml": title,
        "modalTime": "",
        "offType": off_type,
    }


@dataclass
class UserEntry:
    username: str
    password: str
    doc_ref: Optional[Any] = None
    doc_id: Optional[str] = None
    display_name: Optional[str] = None


def _get_secret(key: str, fallback: str) -> str:
    value: Optional[str] = os.environ.get(key)
    return value if value else fallback


def _decrypt_password_if_needed(value: Any, aad: str) -> str:
    if not isinstance(value, str):
        return ""
    if not value.startswith(f"{ENCRYPTION_VERSION}:"):
        return value
    print(
        f"[Firestore] doc {aad}: mot de passe encore chiffré. Merci de le réenregistrer dans l'application."
    )
    return ""


def _fill_login_form(page: Page, username: str, password: str) -> None:
    page.fill("#login", username, timeout=15000)
    page.fill('input[name="password"]', password, timeout=15000)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Automatise la connexion a Ecole en Ligne.")
    parser.add_argument("--at", dest="run_at", help="Heure (HH:MM) a laquelle lancer la premiere tentative.")
    parser.add_argument("--repeat", type=int, help="Intervalle en minutes entre deux tentatives successives.")
    parser.add_argument("--service-account", type=Path, default=DEFAULT_SERVICE_ACCOUNT,
                        help=f"Chemin du JSON (defaut: {DEFAULT_SERVICE_ACCOUNT.name}).")
    parser.add_argument("--firestore-collection", default=DEFAULT_FIRESTORE_COLLECTION,
                        help="Nom de la collection Firestore.")
    parser.add_argument("--firestore-user-field", default=DEFAULT_FIRESTORE_USER_FIELD,
                        help="Champ identifiant Firestore.")
    parser.add_argument("--firestore-pass-field", default=DEFAULT_FIRESTORE_PASS_FIELD,
                        help="Champ mot de passe Firestore.")
    parser.add_argument("--only-uid", default=None)
    parser.add_argument("--fast", action="store_true")
    parser.add_argument("--app-url", dest="app_url", default=os.environ.get(APP_URL_ENV, ""),
                        help="URL de l'app (console).")
    args = parser.parse_args()
    if args.repeat is not None and args.repeat <= 0:
        parser.error("--repeat doit etre superieur a 0.")
    # Tune global timings for fast mode
    global SHORT_PAUSE_MS, MAX_CHECKBOX_CLICKS
    if args.fast:
        SHORT_PAUSE_MS = 150
        try:
            MAX_CHECKBOX_CLICKS = max(10, int(MAX_CHECKBOX_CLICKS / 2))
        except Exception:
            MAX_CHECKBOX_CLICKS = 15
    return args


def _load_users_from_firestore(args: argparse.Namespace) -> List[UserEntry]:
    global FIRESTORE_MODULE
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
    except ImportError:
        print("firebase-admin non installé; fallback sur variables d'environnement.")
        return []

    env_sa = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    cred = None
    if env_sa:
        try:
            info = json.loads(env_sa)
            cred = credentials.Certificate.from_service_account_info(info)
        except Exception:
            print("FIREBASE_SERVICE_ACCOUNT_JSON invalide; fallback sur variables d'environnement.")
            return []
    else:
        service_account = args.service_account
        if not service_account.exists():
            print(f"Compte de service introuvable : {service_account}; fallback sur variables d'environnement.")
            return []
        try:
            cred = credentials.Certificate(service_account)
        except Exception:
            print("Impossible de charger le compte de service; fallback sur variables d'environnement.")
            return []

    FIRESTORE_MODULE = firestore
    if not firebase_admin._apps:
        try:
            firebase_admin.initialize_app(cred)
        except Exception:
            print("Initialisation firebase-admin échouée; fallback sur variables d'environnement.")
            return []

    db = firestore.client()
    docs = list(db.collection(args.firestore_collection).stream())
    if args.only_uid:
        docs = [d for d in docs if getattr(d, "id", None) == args.only_uid]

    users: List[UserEntry] = []
    for doc in docs:
        data = doc.to_dict() or {}
        username = data.get(args.firestore_user_field)
        password_raw = data.get(args.firestore_pass_field)
        has_user = isinstance(username, str) and bool(username.strip())
        decrypted_password = ""
        has_pass = False
        if isinstance(password_raw, str) and password_raw.strip():
            decrypted_password = password_raw
            has_pass = bool(decrypted_password.strip())
        try:
            print(f"[Firestore] doc {doc.id}: {args.firestore_user_field}={'OK' if has_user else 'KO'}; {args.firestore_pass_field}={'OK' if has_pass else 'KO'}")
        except Exception:
            # doc.id may contain non-str; ensure logging doesn't break flow
            pass
        if has_user and has_pass:
            display_name = data.get("displayName") or data.get("name")
            users.append(UserEntry(username=username, password=decrypted_password,
                                   doc_ref=doc.reference, doc_id=doc.id, display_name=display_name))
        else:
            print(f"Document {doc.id} ignore : champs manquants ou invalides.")

    if users:
        print(f"{len(users)} utilisateur(s) charge(s) depuis Firestore ({args.firestore_collection}).")
    else:
        print(f"Aucun utilisateur valide trouve dans Firestore ({args.firestore_collection}).")
    return users


def _load_users(args: argparse.Namespace) -> List[UserEntry]:
    users = _load_users_from_firestore(args)
    if users:
        return users
    print("Aucun utilisateur Firestore valide. Utilisation du fallback.")
    username = _get_secret(USERNAME_ENV, DEFAULT_USERNAME)
    password = _get_secret(PASSWORD_ENV, DEFAULT_PASSWORD)
    return [UserEntry(username=username, password=password)]


def _wait_until(run_at: Optional[str]) -> None:
    if not run_at:
        return
    try:
        target_time = datetime.strptime(run_at, "%H:%M").time()
    except ValueError as exc:
        raise SystemExit(f"Heure invalide '{run_at}' (HH:MM).") from exc
    now = datetime.now()
    scheduled = now.replace(hour=target_time.hour, minute=target_time.minute, second=0, microsecond=0)
    if scheduled <= now:
        scheduled += timedelta(days=1)
    wait_seconds = (scheduled - now).total_seconds()
    print(f"Attente programmee jusqu'a {scheduled.strftime('%d/%m %H:%M')} (~{int(wait_seconds)}s).")
    time.sleep(wait_seconds)


class LoginFailedError(RuntimeError):
    """Raised when the portal refuses the credentials."""


def _sanitize_for_filename(value: str) -> str:
    safe = "".join(ch if ch.isalnum() else "_" for ch in value).strip("_")
    return safe[:50] or "session"


def _highlight_target(target: Locator, label: str = "") -> None:
    if not ENABLE_HIGHLIGHT:
        return
    try:
        target.wait_for(state="visible", timeout=5000)
    except PlaywrightTimeoutError:
        print(f"[bot] Highlight impossible {label}: element invisible.")
        return
    try:
        target.scroll_into_view_if_needed(timeout=2000)
        box = target.bounding_box()
        if not box:
            print(f"[bot] Highlight impossible {label}: bounding box vide.")
            return
        target.page.evaluate(
            """
            ({ left, top, width, height }) => {
                const overlay = document.createElement('div');
                overlay.style.position = 'fixed';
                overlay.style.left = `${left}px`;
                overlay.style.top = `${top}px`;
                overlay.style.width = `${Math.max(width, 2)}px`;
                overlay.style.height = `${Math.max(height, 2)}px`;
                overlay.style.border = '4px solid #ff5722';
                overlay.style.borderRadius = '12px';
                overlay.style.backgroundColor = 'rgba(255, 235, 59, 0.55)';
                overlay.style.pointerEvents = 'none';
                overlay.style.zIndex = '2147483647';
                document.body.appendChild(overlay);
                setTimeout(() => { overlay.remove(); }, 2000);
            }
            """,
            box,
        )
        print(f"[bot] Highlight sur {label or 'element'}.")
    except Exception as exc:
        print(f"[bot] Highlight impossible {label}: {exc}")


def _click_with_log(target: Locator, description: str) -> bool:
    try:
        target.wait_for(state="visible", timeout=5000)
    except PlaywrightTimeoutError:
        print(f"[bot] Clic annule: {description} invisible.")
        return False
    try:
        _highlight_target(target, description)
        target.click()
        print(f"[bot] Clic effectue sur {description}.")
        return True
    except Exception as exc:
        print(f"[bot] Echec du clic sur {description}: {exc}")
        return False


def _post_login_actions(page: Page, entry: Optional[UserEntry]) -> None:
    target_url = TARGET_AGENDA_URL
    print(f"[bot] Ouverture du journal de classe dans un nouvel onglet: {target_url}")
    max_attempts = 3
    agenda_tab = None
    
    for attempt in range(max_attempts):
        try:
            agenda_tab = page.context.new_page()
            _attach_console_logging(agenda_tab, label="agenda")
            
            # Navigation avec retry
            try:
                agenda_tab.goto(target_url, wait_until="domcontentloaded", timeout=15000)
            except Exception as nav_exc:
                print(f"[bot] Tentative {attempt + 1}/{max_attempts} navigation échouée: {nav_exc}")
                if attempt < max_attempts - 1:
                    try:
                        agenda_tab.close()
                    except Exception:
                        pass
                    _short_pause(page, 2000)
                    continue
                else:
                    raise nav_exc
                    
            break  # Succès
        except Exception as exc:
            print(f"[bot] Echec ouverture agenda tentative {attempt + 1}: {exc}")
            if attempt == max_attempts - 1:
                print(f"[bot] Echec d'ouverture du journal de classe après {max_attempts} tentatives: {exc}")
                return
    
    if not agenda_tab:
        print("[bot] Impossible de créer l'onglet agenda")
        return
    
    try:
        agenda_tab.bring_to_front()
    except Exception:
        pass
    _short_pause(agenda_tab)
    try:
        agenda_tab.wait_for_load_state("load", timeout=5000)
    except PlaywrightTimeoutError:
        pass
    print("[bot] Journal de classe charge dans le nouvel onglet.")

    _ensure_all_filters_checked(agenda_tab)
    _short_pause(agenda_tab)

    try:
        agenda_tab.wait_for_load_state("domcontentloaded", timeout=2000)
    except PlaywrightTimeoutError:
        pass
    _short_pause(agenda_tab)

    try:
        agenda_tab.click('a[href="#month"]', timeout=1000)
        agenda_tab.wait_for_selector('#month', state='visible', timeout=1500)
    except Exception:
        print("[bot] Impossible d'ouvrir l'onglet Mois.")
    _short_pause(agenda_tab)
    try:
        agenda_tab.wait_for_selector('#month tr.fc-list-item', timeout=2000)
    except Exception:
        print("[bot] Aucun tr.fc-list-item visible dans #month (timeout).")
    try:
        agenda_tab.wait_for_function(
            "() => document.querySelectorAll('#month tr.fc-list-item').length > 0",
            timeout=4000,
        )
    except PlaywrightTimeoutError:
        print("[bot] Aucun devoir charge dans #month (wait_for_function timeout).")
    try:
        count_raw = agenda_tab.evaluate("() => document.querySelectorAll('#month tr.fc-list-item').length")
        print(f"[bot] Debug: {count_raw} ligne(s) brut dans #month.")
    except Exception as exc:
        print(f"[bot] Debug: impossible de compter les items du mois ({exc}).")

    month_fr = _infer_current_month_fr(agenda_tab)
    print(f"[bot] Mois cible inferé: {month_fr}")

    items_month = _extract_homeworks_from_scope(agenda_tab, '#month', 'month', filter_month_fr=month_fr)
    print(f"[bot] Items extraits pour {month_fr.capitalize()}: {len(items_month)}")

    if not items_month:
        print("[bot] Aucun item après filtre mois; fallback sans filtre.")
        items_month = _extract_homeworks_from_scope(agenda_tab, '#month', 'month', filter_month_fr=None)
        print(f"[bot] Fallback items mois: {len(items_month)}")
    if not items_month:
        print("[bot] Aucun item dans #month; tentative via event IDs…")
        ids = _collect_event_ids(agenda_tab, '#month')
        print(f"[bot] Event IDs trouves: {len(ids)}")
        if ids:
            synth_items = [{ 'eventId': eid } for eid in ids]
            clicked, modal_details = _click_events_by_items(agenda_tab, synth_items)
            print(f"[bot] Devoirs cliques via IDs: {clicked}")
            # Construire items a partir des details modaux
            items_month = []
            for d in modal_details or []:
                items_month.append({
                    'eventId': d.get('eventId'),
                    'subject': d.get('modalSubject') or '',
                    'labels': [],
                    'title': d.get('modalTitle') or '',
                    'assignedDate': d.get('modalDate') or '',
                    'dueHeading': d.get('modalDate') or '',
                    'source': 'month',
                    'modalDetail': d.get('modalDetail') or '',
                    'modalMeta': d.get('modalMeta') or [],
                    'modalRawText': d.get('modalRawText') or '',
                    'modalHtml': d.get('modalHtml') or '',
                    'modalTime': d.get('modalTime') or '',
                })
            print(f"[bot] Items reconstruits depuis modales: {len(items_month)}")
    if not items_month:
        print("[bot] Toujours aucun item; fallback sur l'onglet actif.")
        items_month = _extract_homeworks_from_scope(agenda_tab, None, 'active', filter_month_fr=None)
        print(f"[bot] Fallback onglet actif: {len(items_month)}")
    if not items_month:
        try:
            html = agenda_tab.evaluate("() => (document.querySelector('#month') || document.body).innerHTML")
            dbg_path = Path(__file__).resolve().parents[1] / 'bot' / 'debug_month.html'
            dbg_path.write_text(str(html), encoding='utf-8')
            print(f"[bot] Debug dump ecrit: {dbg_path}")
        except Exception as exc:
            print(f"[bot] Echec dump debug_month.html: {exc}")

    items_todo = _filter_items_by_label(items_month, 'a faire')
    print(f"[bot] Items 'A faire' retenus: {len(items_todo)}")
    used_fallback_for_clicks = False
    if not items_todo and items_month:
        print("[bot] Aucun label 'A faire' détecté, fallback sur tous les items du mois avant clic.")
        items_todo = list(items_month)
        used_fallback_for_clicks = True

    clicked, modal_details = _click_events_by_items(agenda_tab, items_todo)
    print(f"[bot] Devoirs cliqués ({month_fr.capitalize()} / {'fallback' if used_fallback_for_clicks else 'A faire'}) : {clicked}")

    if modal_details:
        modal_map = {str(d.get('eventId')): d for d in modal_details if d.get('eventId')}
        for it in items_todo:
            eid = str(it.get('eventId') or '').strip()
            if not eid:
                continue
            extra = modal_map.get(eid)
            if not extra:
                continue
            it['modalDate'] = extra.get('modalDate')
            it['modalSubject'] = extra.get('modalSubject')
            it['modalTitle'] = extra.get('modalTitle')
            it['modalDetail'] = extra.get('modalDetail')
            it['modalMeta'] = extra.get('modalMeta')
            it['modalRawText'] = extra.get('modalRawText')
            it['modalHtml'] = extra.get('modalHtml')
            it['modalTime'] = extra.get('modalTime')

 
    _extract_and_store_homeworks(agenda_tab, page.context, entry=entry, items_override=None)
    
    # Nettoyage final de l'onglet agenda
    try:
        agenda_tab.close()
    except Exception:
        pass


def _ensure_all_filters_checked(page: Page) -> None:
    candidates = [
        "#legend input[type=checkbox]",
        ".legend input[type=checkbox]",
        ".filters input[type=checkbox]",
        "form input[type=checkbox]",
        "input[type=checkbox].filtre",
        "input[type=checkbox]",
    ]
    clicked = 0
    for sel in candidates:
        _short_pause(page)
        try:
            loc = page.locator(sel)
            count = loc.count()
        except Exception:
            continue
        if count == 0:
            continue
        for i in range(count):
            if clicked >= MAX_CHECKBOX_CLICKS:
                break
            el = loc.nth(i)
            try:
                if not el.is_visible() or not el.is_enabled():
                    continue
                try:
                    if el.is_checked():
                        continue
                except Exception:
                    pass
                try:
                    el.check(timeout=500)
                except Exception:
                    el.click(timeout=500)
                _short_pause(page)
                clicked += 1
            except Exception:
                continue
        if clicked:
            break
    if clicked:
        print(f"[bot] {clicked} case(s) de filtre activée(s).")
    else:
        print("[bot] Aucune case de filtre détectée (ou déjà toutes actives).")


def _has_homework(page: Page) -> bool:
    selectors = [
        "li.devoir",
        "tr.devoir",
        ".devoir",
        ".homework",
        "[data-type=devoir]",
        ".task",
        ".tache",
        "#agenda li",
        "#agenda .item",
    ]
    try:
        for sel in selectors:
            try:
                if page.locator(sel).count() > 0:
                    return True
            except Exception:
                continue
        body_text = page.evaluate("() => document.body.innerText || ''")
        if body_text and re.search(r"Aucun\s+devoir|Pas\s+de\s+devoir", body_text, flags=re.I):
            return False
        return False
    except Exception:
        return False


def _active_tab_scope_selector(page: Page) -> Optional[str]:
    try:
        href = page.locator('.nav.nav-tabs li.active a').first.get_attribute('href')
        if href and href.startswith('#'):
            return href
    except Exception:
        pass
    return None


def _collect_event_ids(page: Page, scope_selector: Optional[str] = None) -> List[str]:
    scope = scope_selector or _active_tab_scope_selector(page) or ''
    sel = f"{scope} tr.fc-list-item td[onclick*=view_event_agenda]"
    try:
        ids = page.eval_on_selector_all(sel, "els => Array.from(new Set(els.map(el => el.id).filter(Boolean)))")
        ids = list(ids or [])
        if ids:
            print(f"[bot] Found {len(ids)} event id(s) in scope '{scope or 'active'}'.")
        return ids
    except Exception as exc:
        print(f"[bot] Erreur collecte event IDs: {exc}")
        return []


def _try_close_modal(page: Page) -> None:
    candidates = [
        '.modal.in .close',
        '.modal .close',
        'button.close',
        '[data-dismiss="modal"]',
        'button.bootbox-close-button',
    ]
    for sel in candidates:
        try:
            loc = page.locator(sel)
            if loc.count() and loc.first.is_visible():
                loc.first.click(timeout=500)
                page.wait_for_timeout(150)
                return
        except Exception as exc:
            print(f"[bot] Erreur fermeture modal ({sel}): {exc}")
            continue
    try:
        page.keyboard.press('Escape')
    except Exception as exc:
        print(f"[bot] Erreur touche Echap: {exc}")


def _open_event_modal(page: Page, event_id: str) -> bool:
    try:
        ran = page.evaluate(
            "id => (window.view_event_agenda ? (view_event_agenda(Number(id)), true) : false)",
            event_id,
        )
        if not ran:
            try:
                page.locator(f'td#{event_id}').first.click(timeout=600)
            except Exception:
                page.locator(f'[onclick*="view_event_agenda({event_id})"]').first.click(timeout=600)
        _short_pause(page)
        try:
            page.wait_for_selector('#ViewAgendaEleve', state='visible', timeout=2000)
        except PlaywrightTimeoutError:
            pass
        print(f"[bot] Modal ouvert pour event {event_id}.")
        return True
    except Exception as exc:
        print(f"[bot] Ouverture modal event {event_id} impossible: {exc}")
        return False


def _extract_modal_details(page: Page, event_id: str) -> Optional[dict]:
    try:
        page.wait_for_selector('#ViewAgendaEleve', state='visible', timeout=1500)
    except PlaywrightTimeoutError:
        print(f"[bot] Modal non visible pour event {event_id}.")
        return None

    def _safe_input(selector: str) -> str:
        try:
            return page.locator(selector).input_value(timeout=500) or ""
        except Exception:
            try:
                return page.locator(selector).inner_text(timeout=500).strip()
            except Exception:
                return ""

    modal_date = _safe_input('#date_agenda')
    modal_subject = _safe_input('#matiere_agenda')
    modal_title = _safe_input('#titre_agenda')
    modal_detail = ""
    # Essayer de récupérer le détail de différentes manières
    try:
        # Essayer d'abord avec input_value (pour les champs de formulaire)
        modal_detail = page.locator('#detail_agenda').input_value(timeout=500)
    except Exception:
        try:
            # Sinon essayer avec inner_text
            modal_detail = page.locator('#detail_agenda').inner_text(timeout=500).strip()
        except Exception:
            try:
                # Essayer avec une approche plus large si les sélecteurs standards échouent
                modal_detail = page.evaluate("""
                    () => {
                        const el = document.querySelector('#detail_agenda');
                        if (!el) return '';
                        // Essayer d'abord la propriété value, puis textContent
                        return el.value || el.textContent || '';
                    }
                """)
            except Exception:
                modal_detail = ""

    def _collect_modal_meta() -> Tuple[List[str], str, str]:
        try:
            meta_items = page.evaluate(
                """
                () => {
                  const root = document.querySelector('#ViewAgendaEleve .modal-body') || document.querySelector('#ViewAgendaEleve');
                  if (!root) return { items: [], text: '', html: '' };
                  const items = Array.from(root.querySelectorAll('li'))
                    .map((li) => (li.innerText || li.textContent || '').replace(/\\s+/g, ' ').trim())
                    .filter(Boolean);
                  const text = (root.innerText || root.textContent || '').replace(/\\s+/g, ' ').trim();
                  const html = root.innerHTML || '';
                  return { items, text, html };
                }
                """
            ) or {"items": [], "text": "", "html": ""}
        except Exception:
            meta_items = {"items": [], "text": "", "html": ""}
        items = list(meta_items.get("items", []))
        text = str(meta_items.get("text", ""))
        html = str(meta_items.get("html", ""))
        return items, text, html

    def _extract_modal_time(chunks: List[str]) -> str:
        patterns = [
            r"\b(\d{1,2})h(?:\s*(\d{1,2}))?\b",
            r"\b(\d{1,2}):(\d{2})\b",
        ]
        for chunk in chunks:
            if not chunk:
                continue
            for pat in patterns:
                match = re.search(pat, chunk)
                if match:
                    hh = int(match.group(1))
                    mm = match.group(2)
                    mm_val = int(mm) if mm and mm.isdigit() else 0
                    hh = max(0, min(23, hh))
                    mm_val = max(0, min(59, mm_val))
                    return f"{hh:02d}:{mm_val:02d}"
        return ""

    raw_meta_items, modal_text, modal_html = _collect_modal_meta()

    eval_flag = False
    meta_items: List[str] = []
    for item in raw_meta_items:
        normalized = _normalize_text(item)
        if "evaluation sommative" in normalized or "interrogation" in normalized or "interro" in normalized:
            eval_flag = True
            continue
        meta_items.append(item)

    if meta_items:
        control_index = next((i for i, value in enumerate(meta_items)
                              if "controle" in _normalize_text(value) or "interrogation" in _normalize_text(value) or "interro" in _normalize_text(value)), None)
        if control_index is not None and len(meta_items) > 1:
            last_index = len(meta_items) - 1
            if control_index != last_index:
                combined = f"{meta_items[control_index]} — {meta_items[last_index]}"
                meta_items[last_index] = combined
                del meta_items[control_index]

    modal_time = _extract_modal_time([modal_detail, modal_title, modal_subject, modal_text] + meta_items)

    # S'assurer que la description est bien incluse dans les métadonnées
    if modal_detail and modal_detail.strip() and not any(modal_detail.strip() in m for m in meta_items):
        meta_items.insert(0, modal_detail.strip())
        
    details = {
        'eventId': event_id,
        'modalDate': modal_date,
        'modalSubject': modal_subject,
        'modalTitle': modal_title,
        'modalDetail': modal_detail,
        'modalMeta': meta_items,
        'modalRawText': modal_text,
        'modalHtml': modal_html,
        'modalTime': modal_time,
        'modalHasEvaluationKeyword': eval_flag,
        'description': modal_detail,  # Ajout explicite de la description
    }
    meta_preview = ", ".join(meta_items[:3])
    print(f"[bot] Modal details pour {event_id}: date={modal_date}, matiere={modal_subject}, time={modal_time}, meta=[{meta_preview}]")
    return details


def _click_all_visible_events(page: Page, scope_selector: Optional[str] = None) -> int:
    ids = _collect_event_ids(page, scope_selector)
    clicked = 0
    for eid in ids:
        if clicked >= 50:
            break
        _short_pause(page)
        if _open_event_modal(page, eid):
            clicked += 1
            _try_close_modal(page)
    return clicked


def _click_events_by_items(page: Page, items: List[dict]) -> Tuple[int, List[dict]]:
    clicked = 0
    collected: List[dict] = []
    for it in items:
        if clicked >= 50:
            break
        eid = str(it.get('eventId') or '').strip()
        if not eid:
            continue
        _short_pause(page)
        if _open_event_modal(page, eid):
            clicked += 1
            details = _extract_modal_details(page, eid)
            if details:
                collected.append(details)
            _short_pause(page)
            _try_close_modal(page)
    return clicked, collected


def _filter_items_by_label(items: List[dict], keyword: str) -> List[dict]:
    target = _normalize_fr(keyword)
    result: List[dict] = []
    for it in items:
        labels = it.get('labels') or []
        if not isinstance(labels, list):
            continue
        for label in labels:
            if target in _normalize_fr(str(label)):
                result.append(it)
                break
    return result


def _extract_homeworks_from_scope(page: Page, scope_selector: Optional[str], source: str,
                                  filter_month_fr: Optional[str] = None) -> List[dict]:
    scope = scope_selector or _active_tab_scope_selector(page) or ''
    js = r"""
    (scopeSel, source) => {
      const root = scopeSel ? document.querySelector(scopeSel) : document;
      if (!root) return [];
      let rows = Array.from(root.querySelectorAll('tr.fc-list-item'));
      if (!rows.length) {
        rows = Array.from(root.querySelectorAll('tr'));
      }
      const findHeading = (tr) => {
        let p = tr.previousElementSibling;
        let attempts = 0;
        const MAX_ATTEMPTS = 10;
        while (p && !p.classList.contains('fc-list-heading') && attempts < MAX_ATTEMPTS) {
          p = p.previousElementSibling;
          attempts++;
        }
        while (p && !p.classList.contains('fc-list-heading') && attempts < MAX_ATTEMPTS) {
          p = p.previousElementSibling;
          attempts++;
        }
        if (p && p.querySelector('.fc-list-heading-main')) return p.querySelector('.fc-list-heading-main').textContent.trim();
        let parent = tr.parentElement;
        let parentAttempts = 0;
        const MAX_PARENT_ATTEMPTS = 5;
        while (parent && parent !== document.body && parentAttempts < MAX_PARENT_ATTEMPTS) {
          const h = parent.querySelector('.fc-list-heading .fc-list-heading-main');
          if (h) return h.textContent.trim();
          parent = parent.parentElement;
          parentAttempts++;
        }
        return '';
      };
      const safe = (el) => (el && typeof el.textContent === 'string' ? el.textContent.trim() : '');
      const out = [];
      for (let i = 0; i < rows.length; i++) {
        const tr = rows[i];
        try {
          const idCell = tr.querySelector('td[id]');
          let eventId = idCell ? idCell.id : '';
          if (!eventId) {
            const oc = tr.querySelector('td[onclick*="view_event_agenda("]');
            if (oc && typeof oc.getAttribute === 'function') {
              const m = /view_event_agenda\((\d+)\)/.exec(oc.getAttribute('onclick') || '');
              if (m) eventId = m[1];
            }
          }
          if (!eventId) eventId = `row_${i}`;
          let subject = safe(tr.querySelector('td.fc-list-item-title'));
          if (!subject) subject = safe(tr.querySelector('td:nth-child(2)'));
          const labels = Array.from(tr.querySelectorAll('small.label, td small')).map(safe).filter(Boolean);
          let title = safe(tr.querySelector('a'));
          if (!title) title = safe(tr.querySelector('td:nth-child(6) a'));
          let assignedDate = safe(tr.querySelector('td:last-child small'));
          if (!assignedDate) assignedDate = (labels.length ? labels[labels.length-1] : '');
          const dueHeading = findHeading(tr);
          out.push({ eventId, subject, labels, title, assignedDate, dueHeading, source });
        } catch (e) {
          // ignore row errors
        }
      }
      return out;
    }
    """
    try:
        items = page.evaluate(js, [scope, source]) or []
        if filter_month_fr:
            key = _normalize_fr(str(filter_month_fr))
            tmp = []
            for it in items:
                head = _normalize_fr(str(it.get('dueHeading', '')))
                if key in head:
                    tmp.append(it)
            items = tmp
        return items
    except Exception as exc:
        print(f"[bot] Extraction JS exception for scope '{scope}': {exc}")
        return []


def _normalize_fr(text: str) -> str:
    try:
        nf = unicodedata.normalize('NFD', text.replace('\xa0', ' ').strip())
        nf = ''.join(ch for ch in nf if unicodedata.category(ch) != 'Mn')
        return nf.lower()
    except Exception:
        return str(text).replace('\xa0', ' ').strip().lower()


def _infer_current_month_fr(page: Page) -> str:
    month_map = {
        1: 'janvier', 2: 'fevrier', 3: 'mars', 4: 'avril', 5: 'mai', 6: 'juin',
        7: 'juillet', 8: 'aout', 9: 'septembre', 10: 'octobre', 11: 'novembre', 12: 'decembre'
    }
    try:
        val = page.locator('#dateSelectAgenda').input_value(timeout=500)
        m = re.match(r'\s*(\d{2})/(\d{2})/(\d{4})\s*$', val or '')
        if m:
            month_num = int(m.group(2))
            return month_map.get(month_num, 'octobre')
    except Exception:
        pass
    return month_map.get(datetime.now().month, 'octobre')


def _write_user_homeworks_js(user_uid: str, items: List[dict]) -> Path:
    # Always use the Firestore user document id (UID) to isolate per-user files
    safe_uid = _sanitize_for_filename(user_uid or 'user')
    project_root = Path(__file__).resolve().parents[1]
    out_dir = project_root / 'public' / 'import' / safe_uid
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f'devoirs_{safe_uid}.js'
    payload = {
        'generatedAt': datetime.now().isoformat(timespec='seconds'),
        'count': len(items),
        'items': items,
    }
    content = 'export const devoirs = ' + json.dumps(payload, ensure_ascii=False, indent=2) + ';\n'
    out_path.write_text(content, encoding='utf-8')
    return out_path


def _extract_and_store_homeworks(page: Page, context, entry: Optional[UserEntry],
                                 items_override: Optional[List[dict]] = None) -> None:
    # Use only UID for per-user isolation
    user_uid = (entry.doc_id or 'session') if entry else 'session'
    if items_override is not None:
        print(f"[bot] Utilisation de items_override avec {len(items_override)} éléments")
        all_items: List[dict] = list(items_override)
    else:
        print("[bot] Extraction des devoirs depuis les onglets...")
        all_items = []
        all_items.extend(_extract_homeworks_from_scope(page, None, 'active'))
        try:
            page.click('a[href="#month"]', timeout=500)
            page.wait_for_selector('#month', state='visible', timeout=800)
        except Exception:
            pass
        all_items.extend(_extract_homeworks_from_scope(page, '#month', 'month'))
        try:
            page.click('a[href="#J_30"]', timeout=500)
            page.wait_for_selector('#J_30', state='visible', timeout=800)
        except Exception:
            pass
        j30_items = _extract_homeworks_from_scope(page, '#J_30', 'J_30')
        print(f"[bot] Items extraits pour J+30: {len(j30_items)}")
        if j30_items:
            print(f"[bot] Détail J+30: {j30_items[0].get('title', 'No title')} - {j30_items[0].get('assignedDate', 'No date')}")
            # Cliquer sur les modales J+30 pour récupérer les vraies dates
            clicked, modal_details = _click_events_by_items(page, j30_items)
            print(f"[bot] Devoirs cliqués (J+30): {clicked}")
            if modal_details:
                modal_map = {str(d.get('eventId')): d for d in modal_details if d.get('eventId')}
                for it in j30_items:
                    eid = str(it.get('eventId') or '').strip()
                    if not eid:
                        continue
                    extra = modal_map.get(eid)
                    if not extra:
                        continue
                    it['modalDate'] = extra.get('modalDate')
                    it['modalSubject'] = extra.get('modalSubject')
                    it['modalTitle'] = extra.get('modalTitle')
                    it['modalDetail'] = extra.get('modalDetail')
                    it['modalMeta'] = extra.get('modalMeta')
                    it['modalRawText'] = extra.get('modalRawText')
                    it['modalHtml'] = extra.get('modalHtml')
                    it['modalTime'] = extra.get('modalTime')
        all_items.extend(j30_items)
        
        # S'assurer que les filtres sont aussi cochés dans J+30
        _ensure_all_filters_checked(page)

    # Filtrer les devoirs antérieurs à aujourd'hui (et ceux du jour déjà passés)
    now = datetime.now()
    today = now.date()
    current_time = now.time()
    filtered_items = []
    for item in all_items:
        date_str = item.get('modalDate') or item.get('assignedDate') or item.get('dueHeading')
        time_str = item.get('modalTime') or item.get('heure')
        
        if date_str:
            # Parser la date avec plusieurs méthodes
            item_date = None
            for parser in (_parse_ddmmyyyy, _parse_french_text_date, _parse_iso_date):
                try:
                    parsed = parser(date_str)
                    if parsed:
                        item_date = parsed
                        break
                except Exception:
                    continue
            
            # Si la date est trouvée et valide, vérifier si elle n'est pas passée
            if item_date:
                item_date_only = item_date.date()
                if item_date_only > today:
                    # Devoir futur - on garde
                    filtered_items.append(item)
                elif item_date_only < today:
                    # Devoir passé - on ignore
                    print(f"[bot] Devoir ignoré (date passée): {date_str} -> {item_date_only}")
                else:  # aujourd'hui
                    # Pour les devoirs du jour, vérifier l'heure
                    if time_str:
                        try:
                            # Parser l'heure (format HH:MM ou HHhMM)
                            time_cleaned = time_str.replace('h', ':').replace('H', ':').strip()
                            if ':' in time_cleaned:
                                hour_min = time_cleaned.split(':')
                                if len(hour_min) >= 2:
                                    item_time = datetime.strptime(f"{hour_min[0]}:{hour_min[1]}", "%H:%M").time()
                                    if item_time > current_time:
                                        # Devoir du jour encore à venir - on garde
                                        filtered_items.append(item)
                                    else:
                                        # Devoir du jour déjà passé - on ignore
                                        print(f"[bot] Devoir ignoré (heure passée aujourd'hui): {date_str} {time_str} -> {item_date_only} {item_time}")
                                else:
                                    # Format d'heure incomplet, on garde par prudence
                                    filtered_items.append(item)
                            else:
                                # Pas de format d'heure reconnu, on garde par prudence
                                filtered_items.append(item)
                        except Exception:
                            # Erreur parsing heure, on garde par prudence
                            filtered_items.append(item)
                    else:
                        # Pas d'heure pour le devoir du jour, on garde par prudence
                        filtered_items.append(item)
            else:
                # Si pas de date parsable, on garde par défaut
                filtered_items.append(item)
        else:
            # Si pas de date du tout, on garde par défaut
            filtered_items.append(item)
    
    print(f"[bot] Devoirs filtrés: {len(filtered_items)} retenus sur {len(all_items)} (dates antérieures ignorées)")

    all_items = sorted(filtered_items, key=_item_sort_key)
    print(f"[bot] Devoirs extraits: {len(all_items)} éléments.")
    
    # Envoi uniquement vers Firestore (plus de fichiers JS)
    try:
        if entry and entry.doc_ref and FIRESTORE_MODULE:
            entry.doc_ref.set(
                {
                    "externalHomeworksUpdatedAt": FIRESTORE_MODULE.SERVER_TIMESTAMP,
                    "externalHomeworksCount": len(all_items),
                },
                merge=True,
            )
            batch = None
            try:
                batch = entry.doc_ref._client.batch()  # type: ignore[attr-defined]
            except Exception:
                batch = None
            updated = 0
            for it in all_items:
                eid = str(it.get("eventId") or "").strip() or f"evt_{updated}"
                doc_ref = entry.doc_ref.collection("externalHomeworks").document(eid)
                data = dict(it)
                data["updatedAt"] = FIRESTORE_MODULE.SERVER_TIMESTAMP
                if batch:
                    batch.set(doc_ref, data, merge=True)  # type: ignore[union-attr]
                else:
                    doc_ref.set(data, merge=True)
                updated += 1
            if batch:
                batch.commit()  # type: ignore[union-attr]
            print(f"[bot] Miroir Firestore externe: {updated} élément(s) dans users/{{uid}}/externalHomeworks.")
    except Exception as exc:
        print(f"[bot] Publication miroir Firestore échouée: {exc}")


def _notify_failure(entry: UserEntry, reason: str) -> None:
    target = entry.display_name or entry.doc_id or entry.username
    if entry.doc_ref and FIRESTORE_MODULE:
        payload = {
            "authStatus": "error",
            "authError": reason,
            "authCheckedAt": FIRESTORE_MODULE.SERVER_TIMESTAMP,
            "needsCredentialUpdate": True,
        }
        entry.doc_ref.set(payload, merge=True)
        print(f"Notification Firestore enregistree pour {target}.")
    else:
        print(f"[ALERTE] {target}: {reason}")


def _notify_success(entry: UserEntry) -> None:
    if entry.doc_ref and FIRESTORE_MODULE:
        payload = {
            "authStatus": "success",
            "authError": None,
            "authCheckedAt": FIRESTORE_MODULE.SERVER_TIMESTAMP,
            "needsCredentialUpdate": False,
        }
        entry.doc_ref.set(payload, merge=True)


def _check_connectivity(url: str, timeout: int = 30000) -> bool:
    """Vérifie si un site est accessible avant de lancer le navigateur"""
    try:
        import requests
        # En CI, sauter la vérification pour contourner les restrictions réseau
        if os.environ.get("GITHUB_ACTIONS"):
            print(f"[bot] Environnement CI détecté - bypass vérification connectivité pour {url}")
            return True
        
        # Augmenter le timeout et ajouter des retries pour les environnements CI
        session = requests.Session()
        session.mount('https://', requests.adapters.HTTPAdapter(max_retries=3))
        response = session.head(url, timeout=timeout, allow_redirects=True)
        accessible = response.status_code < 500
        print(f"[bot] Vérification connectivité {url}: {response.status_code} - {'OK' if accessible else 'KO'}")
        return accessible
    except Exception as exc:
        print(f"[bot] Erreur vérification connectivité {url}: {exc}")
        # En cas d'erreur, essayer de continuer quand même
        return True


def _perform_login(playwright: Playwright, entry: UserEntry, app_url: Optional[str] = None, args: Optional[argparse.Namespace] = None) -> None:
    # Vérification standard pour non-CI
    if not _check_connectivity(PORTAL_URL):
        raise Exception(f"Site {PORTAL_URL} inaccessible. Vérifiez la connectivité réseau.")
    
    headless = bool(args and args.fast)
    # Configuration spécifique pour CI avec timeouts plus longs
    is_ci = os.environ.get("GITHUB_ACTIONS")
    if is_ci:
        print("[bot] Configuration CI: timeouts augmentés et options réseau optimisées")
    
    # Créer un contexte isolé par utilisateur pour éviter la contamination de session
    browser = playwright.chromium.launch(
        headless=headless, 
        slow_mo=0,
        args=[
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ] if is_ci else []
    )
    context = browser.new_context()
    
    # Ajouter un retry pour la navigation avec gestion d'erreur améliorée
    def _safe_goto(page: Page, url: str, max_retries: int = 4) -> bool:
        for attempt in range(max_retries):
            try:
                # Timeouts beaucoup plus longs en CI
                if is_ci:
                    timeout = 60000 if attempt == 0 else 45000  # 60s puis 45s
                else:
                    timeout = 15000 if attempt == 0 else 10000  # 15s puis 10s
                
                # En CI, essayer d'abord sans wait_until pour être plus permissif
                wait_until = None if is_ci and attempt == 0 else "domcontentloaded"
                page.goto(url, wait_until=wait_until, timeout=timeout)
                return True
            except Exception as exc:
                print(f"[bot] Tentative {attempt + 1}/{max_retries} échouée pour {url}: {exc}")
                if attempt < max_retries - 1:
                    # Délai exponentiel : 2s, 4s, 8s
                    delay = min(2000 * (2 ** attempt), 8000)
                    print(f"[bot] Pause de {delay}ms avant nouvelle tentative...")
                    _short_pause(page, delay)
                else:
                    # En dernière tentative, essayer sans wait_until pour timeout minimal
                    try:
                        fallback_timeout = 30000 if is_ci else 5000
                        page.goto(url, timeout=fallback_timeout)
                        print(f"[bot] Connexion réussie avec timeout fallback")
                        return True
                    except Exception as fallback_exc:
                        print(f"[bot] Timeout minimal échoué: {fallback_exc}")
                        raise exc
        return False
    if args and args.fast:
        def _block(route):
            rt = route.request.resource_type
            if rt in ("image", "font", "stylesheet"):
                return route.abort()
            return route.continue_()
        try:
            context.route("**/*", _block)
        except Exception:
            pass
    try:
        page = context.new_page()
        
        # En CI, essayer de se connecter normalement mais avec timeouts plus longs
        is_ci = os.environ.get("GITHUB_ACTIONS")
        if is_ci:
            print("[bot] CI - Tentative de connexion normale à école en ligne")
            # Essayer la connexion normale même en CI
            _safe_goto(page, PORTAL_URL)
            _fill_login_form(page, entry.username, entry.password)
            with page.expect_navigation(wait_until="load", timeout=LOGIN_NAV_TIMEOUT_MS):
                page.click('button[type="submit"]')
            if "login.php" in page.url:
                raise LoginFailedError("Identifiant ou mot de passe incorrect. Merci de mettre a jour vos parametres.")
            try:
                page.wait_for_selector('form[action*="login.php"]', timeout=800)
                raise LoginFailedError("Identifiant ou mot de passe incorrect. Merci de mettre a jour vos parametres.")
            except PlaywrightTimeoutError:
                pass
            try:
                page.wait_for_load_state("networkidle", timeout=LOGIN_NAV_TIMEOUT_MS)
            except PlaywrightTimeoutError:
                print("[bot] Avertissement: attente networkidle expiree apres connexion; poursuite avec l'etat actuel.")
            _post_login_actions(page, entry)
            return
            
        _safe_goto(page, PORTAL_URL)
        _fill_login_form(page, entry.username, entry.password)
        with page.expect_navigation(wait_until="load", timeout=LOGIN_NAV_TIMEOUT_MS):
            page.click('button[type="submit"]')
        if "login.php" in page.url:
            raise LoginFailedError("Identifiant ou mot de passe incorrect. Merci de mettre a jour vos parametres.")
        try:
            page.wait_for_selector('form[action*="login.php"]', timeout=800)
            raise LoginFailedError("Identifiant ou mot de passe incorrect. Merci de mettre a jour vos parametres.")
        except PlaywrightTimeoutError:
            pass
        try:
            page.wait_for_load_state("networkidle", timeout=LOGIN_NAV_TIMEOUT_MS)
        except PlaywrightTimeoutError:
            print("[bot] Avertissement: attente networkidle expiree apres connexion; poursuite avec l'etat actuel.")
        _post_login_actions(page, entry)

        if app_url:
            try:
                app_tab = context.new_page()
                _attach_console_logging(app_tab, label="app")
                app_tab.goto(app_url, wait_until="load")
                print(f"[bot] App ouverte: {app_url}")
            except Exception as exc:
                print(f"[bot] Echec d'ouverture de l'app ({app_url}): {exc}")

        session_name = f"session_{_sanitize_for_filename(entry.username)}.json"
        context.storage_state(path=session_name)
        info(f"Tentative de connexion pour l'utilisateur: {entry.username}")
    except Exception as exc:
        error(f"Erreur lors de la connexion de {entry.username}: {exc}", exc_info=True)
        raise
    finally:
        try:
            context.close()
        except Exception:
            pass
        try:
            browser.close()
        except Exception:
            pass


def main() -> None:
    start_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    logger.info(f"=== Démarrage du bot à {start_time} ===")
    
    args = _parse_args()
    users = _load_users(args)

    _wait_until(args.run_at)

    with sync_playwright() as playwright:
        while True:
            for entry in users:
                label = entry.display_name or entry.username
                info(f"=== Traitement de l'utilisateur: {label} ===")
                try:
                    _perform_login(playwright, entry, app_url=args.app_url or None)
                    _notify_success(entry)
                except LoginFailedError as exc:
                    _notify_failure(entry, str(exc))
                except Exception as exc:
                    _notify_failure(entry, f"Erreur technique lors de la connexion: {exc}")
            if args.repeat is None:
                break
            info(f"Prochaine exécution dans {args.repeat} minute(s)...")
            time.sleep(args.repeat * 60)
            info("=== Redémarrage automatique du bot ===")
            time.sleep(args.repeat * 60)
        print("Exécution terminée")


if __name__ == "__main__":
    main()
