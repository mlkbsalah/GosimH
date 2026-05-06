"""
SECONDLIFE HACKATHON — PHASE 3
Agent de solutions : Triage -> DIY / Reparateur / Remplacement

API sponsor : r9s (https://portal.routetokens.com/)
Modele      : glm-5 (Zhipu AI)
"""

import os
import re
import sys
import json
import httpx
import time
from datetime import datetime
from pathlib import Path

# Fix encodage Windows : evite les crash sur caracteres speciaux dans les prints
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

# Chargement .env manuel (pas besoin de python-dotenv)
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for line in _env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip())

R9S_BASE_URL = "https://api.r9s.ai/v1"
R9S_API_KEY  = os.getenv("R9S_API_KEY", "")
MODEL        = "glm-5"

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

# Verification cle API au demarrage
if not R9S_API_KEY:
    print("ERREUR : R9S_API_KEY non definie.")
    print("  -> Cree un fichier .env avec : R9S_API_KEY=ta_cle")
    print("  -> Ou lance : set R9S_API_KEY=ta_cle  (Windows)")
    print("  ->            export R9S_API_KEY=ta_cle  (Linux/Mac)")
    sys.exit(1)


# ------------------------------------------------------------
#  UTILITAIRE : Appel LLM via r9s
# ------------------------------------------------------------
def call_llm(system_prompt: str, user_message: str, max_tokens: int = 2000) -> str:
    payload = {
        "model": MODEL,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message},
        ],
    }

    for attempt in range(3):
        try:
            response = httpx.post(
                f"{R9S_BASE_URL}/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {R9S_API_KEY}",
                },
                json=payload,
                timeout=120.0,   # timeout augmente
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]

        except Exception as e:
            print(f"Erreur LLM (tentative {attempt+1}/3) : {e}")
            if attempt == 2:
                raise
            time.sleep(1)


# ------------------------------------------------------------
#  UTILITAIRE : Parser JSON sur
# ------------------------------------------------------------
def parse_json(text: str) -> dict:
    # Strategie 1 : bloc ```json ... ```
    match = re.search(r"```json\s*({.*?})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Strategie 2 : premier { ... } valide dans le texte (ignore le "thinking:" avant)
    match = re.search(r"({.*})", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Strategie 3 : nettoyage simple
    try:
        cleaned = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {"raw": text}



# ------------------------------------------------------------
#  AGENT 0 - TRIAGE
# ------------------------------------------------------------
def agent_triage(context: dict) -> dict:
    system = """
Tu es un expert en reparation d'appareils electromenagers.
Tu dois analyser une situation et decider quelle est la meilleure solution parmi :
- "diy"          : reparable soi-meme avec des outils basiques
- "reparateur"   : necessite un professionnel
- "remplacement" : irreparable OU pas rentable (cout reparation > 60% valeur neuve)

Reponds UNIQUEMENT en JSON avec ce format exact :
{
  "decision": "diy" ou "reparateur" ou "remplacement",
  "raison": "explication courte",
  "niveau_difficulte": 1 a 5,
  "cout_reparation_estime": "X - Y euros",
  "valeur_neuf_estimee": "X euros"
}
"""
    user_msg = f"""
Appareil   : {context['marque']} {context['appareil']} ({context['annee']})
Diagnostic : {context['diagnostic']}
Outils disponibles : {', '.join(context['outils'])}
Budget     : {context['budget']} euros
Lieu       : {context['localisation']}
"""
    print("Agent Triage en cours...")
    result = parse_json(call_llm(system, user_msg))
    print("Decision :", result.get("decision"))
    return result


# ------------------------------------------------------------
#  AGENT 1 - DIY
# ------------------------------------------------------------
def agent_diy(context: dict, triage: dict) -> dict:
    system = """
Tu es un expert en reparation DIY d'appareils electromenagers.
Fournis un guide detaille, clair, et structure.

Reponds UNIQUEMENT en JSON :
{
  "titre": "...",
  "duree_estimee": "...",
  "difficulte": "...",
  "materiaux": ["..."],
  "outils_requis": ["..."],
  "etapes": [
    {
      "numero": 1,
      "titre": "...",
      "description": "...",
      "warning": "..." ou null
    }
  ],
  "conseils": ["..."],
  "sources": ["..."]
}
"""
    user_msg = f"""
Appareil   : {context['marque']} {context['appareil']} ({context['annee']})
Probleme   : {context['diagnostic']}
Outils disponibles : {', '.join(context['outils'])}
Raison du triage : {triage.get('raison')}
"""
    print("Agent DIY en cours...")
    result = parse_json(call_llm(system, user_msg, max_tokens=3000))
    print("Guide DIY genere.")
    return result


# ------------------------------------------------------------
#  AGENT 2 - REPARATEUR
# ------------------------------------------------------------
def agent_reparateur(context: dict, triage: dict) -> dict:
    system = """
Tu aides a trouver des reparateurs d'electromenager.
Genere une requete Google Maps optimale.

Reponds UNIQUEMENT en JSON :
{
  "query_maps": "...",
  "specialites_requises": ["..."],
  "budget_max_reparation": "...",
  "questions_a_poser": ["..."],
  "conseils": "..."
}
"""
    user_msg = f"""
Appareil     : {context['marque']} {context['appareil']} ({context['annee']})
Probleme     : {context['diagnostic']}
Localisation : {context['localisation']}
Budget       : {context['budget']} euros
"""
    print("Agent Reparateur : generation des criteres...")
    criteres = parse_json(call_llm(system, user_msg))

    reparateurs = []
    query = criteres.get("query_maps", f"reparateur {context['appareil']} {context['localisation']}")

    if GOOGLE_MAPS_API_KEY:
        try:
            maps_response = httpx.get(
                "https://maps.googleapis.com/maps/api/place/textsearch/json",
                params={"query": query, "key": GOOGLE_MAPS_API_KEY},
                timeout=10.0,
            )
            maps_data = maps_response.json()
            for place in maps_data.get("results", [])[:5]:
                reparateurs.append({
                    "nom":            place["name"],
                    "adresse":        place.get("formatted_address", ""),
                    "note":           place.get("rating"),
                    "nb_avis":        place.get("user_ratings_total"),
                    "ouvert":         place.get("opening_hours", {}).get("open_now"),
                    "google_maps_url": f"https://www.google.com/maps/place/?q=place_id:{place['place_id']}",
                })
        except Exception as e:
            print("Google Maps error:", e)

    if not reparateurs:
        reparateurs = [{
            "nom":            "Recherche Google Maps",
            "adresse":        f"Resultats pour : {query}",
            "note":           None,
            "nb_avis":        None,
            "ouvert":         None,
            "google_maps_url": f"https://www.google.com/maps/search/{query.replace(' ', '+')}",
        }]

    print("Reparateurs trouves :", len(reparateurs))
    return {
        "reparateurs":        reparateurs,
        "criteres_selection": criteres.get("specialites_requises", []),
        "budget_max":         criteres.get("budget_max_reparation"),
        "questions_a_poser":  criteres.get("questions_a_poser", []),
        "conseils":           criteres.get("conseils"),
        "query_utilisee":     query,
    }


# ------------------------------------------------------------
#  AGENT 3 - REMPLACEMENT
# ------------------------------------------------------------
def agent_remplacement(context: dict, triage: dict) -> dict:
    system = """
Tu aides a choisir un appareil de remplacement.

Reponds UNIQUEMENT en JSON :
{
  "analyse": "...",
  "criteres": ["..."],
  "modeles_recommandes": [
    {
      "marque": "...",
      "modele": "...",
      "prix_estime": "...",
      "points_forts": ["..."],
      "query_leboncoin": "...",
      "query_amazon": "..."
    }
  ],
  "conseils_achat": ["..."]
}
"""
    user_msg = f"""
Appareil defectueux  : {context['marque']} {context['appareil']} ({context['annee']})
Probleme             : {context['diagnostic']}
Budget remplacement  : {context['budget']} euros
Cout reparation estime : {triage.get('cout_reparation_estime')}
Valeur neuf estimee    : {triage.get('valeur_neuf_estimee')}
"""
    print("Agent Remplacement en cours...")
    result = parse_json(call_llm(system, user_msg, max_tokens=3000))

    appareil_encoded = f"{context['appareil']}+{context['marque']}".replace(" ", "+")
    result["liens_recherche"] = {
        "leboncoin": f"https://www.leboncoin.fr/recherche?text={appareil_encoded}",
        "fnac":      f"https://www.fnac.com/SearchResult/ResultList.aspx?Search={appareil_encoded}",
        "amazon":    f"https://www.amazon.fr/s?k={appareil_encoded}",
    }

    print("Modeles recommandes :", len(result.get("modeles_recommandes", [])))
    return result


# ------------------------------------------------------------
#  ORCHESTRATEUR PRINCIPAL - Phase 3
# ------------------------------------------------------------
def run_phase3(input_data: dict) -> dict:
    print("\n====================================")
    print("PHASE 3 - Demarrage")
    print("====================================")

    context = {
        "outils":       input_data.get("outils", []),
        "localisation": input_data.get("localisation", ""),
        "budget":       input_data.get("budget", 0),
        "appareil":     input_data.get("appareil", ""),
        "marque":       input_data.get("marque", ""),
        "annee":        input_data.get("annee", ""),
        "diagnostic":   input_data.get("diagnostic", ""),
    }

    triage = agent_triage(context)
    decision = triage.get("decision")

    if decision == "diy":
        solution = {
            "type":   "diy",
            "triage": triage,
            "guide":  agent_diy(context, triage),
        }
    elif decision == "reparateur":
        solution = {
            "type":      "reparateur",
            "triage":    triage,
            "resultats": agent_reparateur(context, triage),
        }
    else:
        solution = {
            "type":         "remplacement",
            "triage":       triage,
            "alternatives": agent_remplacement(context, triage),
        }

    output = {
        "status":    "success",
        "appareil":  f"{context['marque']} {context['appareil']} ({context['annee']})",
        "decision":  decision,
        "solution":  solution,
        "timestamp": datetime.now().isoformat(),
    }

    print("\n====================================")
    print("PHASE 3 - Terminee")
    print("====================================\n")

    return output


# ------------------------------------------------------------
#  TEST RAPIDE
# ------------------------------------------------------------
if __name__ == "__main__":
    test_input = {
        "outils":       ["tournevis", "multimetre"],
        "localisation": "Paris 11e",
        "budget":       150,
        "appareil":     "cafetiere",
        "marque":       "Bosch",
        "annee":        "2022",
        "diagnostic":   "La cafetiere coule lentement et le cafe a un mauvais gout. Filtre encrasse, accumulation de calcaire probable.",
    }

    result = run_phase3(test_input)
    print(json.dumps(result, ensure_ascii=False, indent=2))
