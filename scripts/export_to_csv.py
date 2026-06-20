#!/usr/bin/env python3
import json
import csv
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).parent.parent / "data"
PREDICTIONS_FILE = BASE_DIR / "predictions.json"
MATCHES_FILE = BASE_DIR / "matches.json"
OUTPUT_CSV = BASE_DIR / "predictions.csv"

def main():
    # Load matches to map ID to home/away teams
    if not MATCHES_FILE.exists():
        print(f"Error: {MATCHES_FILE} does not exist.")
        return
    
    with open(MATCHES_FILE, "r", encoding="utf-8") as f:
        matches_list = json.load(f)
    
    # Create lookup map
    matches_map = {m["id"]: m for m in matches_list}
    
    # Load predictions
    if not PREDICTIONS_FILE.exists():
        print(f"Error: {PREDICTIONS_FILE} does not exist.")
        return
        
    with open(PREDICTIONS_FILE, "r", encoding="utf-8") as f:
        predictions_data = json.load(f)
        
    # Prepare CSV rows
    rows = []
    # Headers
    headers = ["participante", "home", "away", "homeScore", "homeAway", "id"]
    
    for participant in predictions_data:
        name = participant.get("name")
        preds = participant.get("predictions", {})
        
        for match_id, scores in preds.items():
            match_info = matches_map.get(match_id)
            if not match_info:
                print(f"Warning: Match ID {match_id} not found in matches.json")
                home_team = ""
                away_team = ""
            else:
                home_team = match_info.get("home", "")
                away_team = match_info.get("away", "")
                
            home_score = scores.get("homeScore")
            away_score = scores.get("awayScore")
            
            rows.append({
                "participante": name,
                "home": home_team,
                "away": away_team,
                "homeScore": home_score,
                "homeAway": away_score,
                "id": match_id
            })
            
    # Write to CSV
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)
        
    print(f"Successfully exported {len(rows)} predictions to {OUTPUT_CSV}")

if __name__ == "__main__":
    main()
