#!/usr/bin/env python3
"""
Convierte predicciones_mundial_2026_todos.csv → predictions.json
Mapea nombres del CSV a IDs de matches.json.
"""

import json, csv, sys
from pathlib import Path

# ── Rutas ────────────────────────────────────────────────────────────────────
BASE = Path(__file__).parent.parent / "data"
CSV_FILE     = BASE / "predicciones_mundial_2026_todos.csv"
MATCHES_FILE = BASE / "matches.json"
OUT_FILE     = BASE / "predictions.json"

# ── Alias de nombres de equipos (CSV → matches.json) ─────────────────────────
TEAM_ALIASES = {
    # Grupo A
    "sudáfrica":          "Sudáfrica",
    "corea del sur":      "Corea del Sur",
    "chequia":            "Chequia",
    "república checa":    "Chequia",
    "mexico":             "México",
    "méxico":             "México",
    # Grupo B
    "canadá":             "Canadá",
    "canada":             "Canadá",
    "bosniay herzegovina":"Bosnia y Herzegovina",
    "bosnia y herzegovina":"Bosnia y Herzegovina",
    "catar":              "Qatar",
    "qatar":              "Qatar",
    "suiza":              "Suiza",
    # Grupo C
    "brasil":             "Brasil",
    "marruecos":          "Marruecos",
    "haití":              "Haití",
    "haiti":              "Haití",
    "escocia":            "Escocia",
    # Grupo D
    "estados unidos":     "Estados Unidos",
    "usa":                "Estados Unidos",
    "paraguay":           "Paraguay",
    "australia":          "Australia",
    "turquía":            "Türkiye",
    "turquia":            "Türkiye",
    "türkiye":            "Türkiye",
    # Grupo E
    "alemania":           "Alemania",
    "curazao":            "Curaçao",
    "curaçao":            "Curaçao",
    "costa de marfil":    "Costa de Marfil",
    "ecuador":            "Ecuador",
    # Grupo F
    "países bajos":       "Países Bajos",
    "paises bajos":       "Países Bajos",
    "japón":              "Japón",
    "japon":              "Japón",
    "suecia":             "Suecia",
    "túnez":              "Túnez",
    "tunez":              "Túnez",
    # Grupo G
    "bélgica":            "Bélgica",
    "belgica":            "Bélgica",
    "egipto":             "Egipto",
    "irán":               "Irán",
    "iran":               "Irán",
    "new zealand":        "Nueva Zelanda",
    "nueva zelanda":      "Nueva Zelanda",
    # Grupo H
    "españa":             "España",
    "espana":             "España",
    "cabo verde":         "Cabo Verde",
    "arabia saudita":     "Arabia Saudita",
    "uruguay":            "Uruguay",
    # Grupo I
    "francia":            "Francia",
    "senegal":            "Senegal",
    "irak":               "Irak",
    "noruega":            "Noruega",
    # Grupo J
    "argentina":          "Argentina",
    "argelia":            "Argelia",
    "austria":            "Austria",
    "jordania":           "Jordania",
    # Grupo K
    "portugal":           "Portugal",
    "uzbekistán":         "Uzbekistán",
    "uzbekistan":         "Uzbekistán",
    "colombia":           "Colombia",
    "jamaica":            "Jamaica",
    "rd del congo":       "Jamaica",   # placeholder en matches.json
    "rd congo":           "Jamaica",
    "rd del congo":       "Jamaica",
    # Grupo L
    "inglaterra":         "Inglaterra",
    "croacia":            "Croacia",
    "ghana":              "Ghana",
    "panamá":             "Panamá",
    "panama":             "Panamá",
}

# Nombres de participante en el JSON final
PARTICIPANT_NAMES = {
    "abner":          "Abner",
    "betzy":          "Betzy",
    "daniel":         "Daniel",
    "daniel tuñón":   "Daniel",
    "danna":          "Danna",
    "edgardo":        "Edgardo",
    "fernando":       "Fernando",
    "gilberto":       "Gilberto",
    "gilberto gómez": "Gilberto",
    "ingrid":         "Ingrid",
    "lucía cheng":    "Luci",
    "luci":           "Luci",
}

def normalize(name: str) -> str:
    return name.strip().lower()

def load_matches():
    with open(MATCHES_FILE, encoding="utf-8") as f:
        return json.load(f)

def build_match_index(matches):
    """
    Builds two lookup structures:
      index[(home_canon, away_canon)] = match_id
      index[(away_canon, home_canon)] = match_id  (reversed, just in case)
    """
    idx = {}
    for m in matches:
        h = normalize(m["home"])
        a = normalize(m["away"])
        idx[(h, a)] = m["id"]
    return idx

def canon(name: str) -> str:
    """Normalize a team name from CSV to canonical form."""
    key = normalize(name)
    resolved = TEAM_ALIASES.get(key, name.strip())
    return normalize(resolved)

def match_id_for(home_csv, away_csv, matches):
    """
    Find match ID given home/away team names from CSV.
    Returns (match_id, swapped) where swapped=True means teams were found in reversed order.
    """
    hc = canon(home_csv)
    ac = canon(away_csv)
    for m in matches:
        mh = canon(m["home"])
        ma = canon(m["away"])
        if mh == hc and ma == ac:
            return m["id"], False
        if mh == ac and ma == hc:
            return m["id"], True  # CSV has teams reversed
    return None, False

def main():
    matches = load_matches()

    # participants dict: name → {"name":..., "avatar":..., "predictions": {}}
    participants = {}

    with open(CSV_FILE, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        unmatched = []

        for row in reader:
            raw_name  = row["Participante"].strip()
            home_team = row["Equipo Local"].strip()
            away_team = row["Equipo Visitante"].strip()
            home_score = int(row["Goles Local"])
            away_score = int(row["Goles Visitante"])

            # Normalize participant name
            pname = PARTICIPANT_NAMES.get(normalize(raw_name), raw_name)

            if pname not in participants:
                participants[pname] = {
                    "name": pname,
                    "avatar": "⚽",
                    "predictions": {}
                }

            mid, swapped = match_id_for(home_team, away_team, matches)
            if mid is None:
                unmatched.append(f"  [{raw_name}] {home_team} vs {away_team}")
            else:
                # If teams were reversed, swap the scores to match match.json order (home=first)
                if swapped:
                    h_pred, a_pred = away_score, home_score
                else:
                    h_pred, a_pred = home_score, away_score

                participants[pname]["predictions"][mid] = {
                    "homeScore": h_pred,
                    "awayScore": a_pred
                }

    # Sort by defined order
    ORDER = ["Abner","Betzy","Daniel","Danna","Edgardo","Fernando","Gilberto","Ingrid","Luci"]
    result = []
    for name in ORDER:
        if name in participants:
            result.append(participants[name])
    # Add any extra participants not in the order
    for name, data in participants.items():
        if name not in ORDER:
            result.append(data)

    # Write output
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"✅ predictions.json generado con {len(result)} participantes.")
    for p in result:
        print(f"   {p['name']}: {len(p['predictions'])} predicciones")

    if unmatched:
        print(f"\n⚠️  {len(unmatched)} filas no encontraron partido en matches.json:")
        for u in unmatched:
            print(u)
    else:
        print("\n✅ Todos los partidos encontrados correctamente.")


if __name__ == "__main__":
    main()
