import json
from datetime import datetime, timedelta

# Files paths
group_dates_path = "data/group_dates.json"
matches_path = "data/matches.json"

with open(group_dates_path, "r") as f:
    group_dates = json.load(f)

with open(matches_path, "r") as f:
    matches = json.load(f)

# Build a map of existing team flags
team_flags = {}
for m in matches:
    h, h_f = m.get("home"), m.get("homeFlag")
    a, a_f = m.get("away"), m.get("awayFlag")
    if h and h_f and h_f != "🏳️":
        team_flags[h] = h_f
    if a and a_f and a_f != "🏳️":
        team_flags[a] = a_f

# Map for new country flag mappings if needed
team_flags['Estados Unidos'] = '🇺🇸'
team_flags['EE. UU.'] = '🇺🇸'
team_flags['A definir'] = '🏳️'

def get_flag(team):
    if not team or team == "A definir":
        return "🏳️"
    return team_flags.get(team, "🏳️")

def convert_local_to_utc_time(local_date_str, local_time_str):
    dt_local = datetime.strptime(f"{local_date_str} {local_time_str}", "%Y-%m-%d %H:%M")
    dt_utc = dt_local + timedelta(hours=5)
    return dt_utc.strftime("%H:%M")

# Index mappings for R32
r32_mapping = {
    "R32_1": 0,
    "R32_2": 2,
    "R32_3": 3,
    "R32_4": 1,
    "R32_5": 5,
    "R32_6": 4,
    "R32_7": 6,
    "R32_8": 7,
    "R32_9": 9,
    "R32_10": 8,
    "R32_11": 11,
    "R32_12": 10,
    "R32_13": 12,
    "R32_14": 14,
    "R32_15": 15,
    "R32_16": 13
}

# Update matches list
updated_count = 0

for m in matches:
    group = m["group"]
    m_id = m["id"]
    
    # We only update knockout stages: R32, R16, QF, SF, FINAL
    if group not in ["R32", "R16", "QF", "SF", "FINAL"]:
        continue
        
    # Determine the corresponding group_dates stage key and index
    gd_stage_key = group
    gd_index = None
    
    if group == "R32":
        gd_index = r32_mapping.get(m_id)
    elif group == "R16":
        try:
            gd_index = int(m_id.split("_")[1]) - 1
        except:
            pass
    elif group == "QF":
        try:
            gd_index = int(m_id.split("_")[1]) - 1
        except:
            pass
    elif group == "SF":
        try:
            gd_index = int(m_id.split("_")[1]) - 1
        except:
            pass
    elif group == "FINAL":
        try:
            gd_index = int(m_id.split("_")[1]) - 1
        except:
            pass
            
    if gd_index is not None:
        gd = group_dates[gd_stage_key][gd_index]
        
        # Calculate new fields
        local_date = gd["date"]
        local_time = gd["time"]
        utc_time = convert_local_to_utc_time(local_date, local_time)
        
        m["home"] = gd["home"]
        m["homeFlag"] = get_flag(gd["home"])
        m["away"] = gd["away"]
        m["awayFlag"] = get_flag(gd["away"])
        m["date"] = local_date
        m["time"] = utc_time
        updated_count += 1

# Write the updated matches back to matches.json with nice indentation
with open(matches_path, "w") as f:
    json.dump(matches, f, indent=2, ensure_ascii=False)

print(f"Successfully updated {updated_count} matches in matches.json!")
