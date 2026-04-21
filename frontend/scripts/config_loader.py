"""
config_loader.py
----------------
Loads configuration from data/config.json - the single source of truth.

Usage in GWO-v5.py:
    from config_loader import load_config
    
    cfg = load_config()
    ROOMS = cfg['rooms']
    ROOM_NAMES = cfg['room_names']
    ROOM_CAPS = cfg['room_caps']
    TIMESLOTS = cfg['timeslots']
    LECTURERS = cfg['lecturers']
    LECTURER_PREFERENCES = cfg['lecturer_preferences']
    LECTURES = cfg['lectures']
    # GWO params
    NUM_WOLVES = cfg['gwo_params']['num_wolves']
    NUM_ITERATIONS = cfg['gwo_params']['num_iterations']
    # etc.
"""

import json
import os

# Path to the config file (relative to the scripts folder)
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "config.json")

# Default configuration (fallback if file doesn't exist)
DEFAULT_CONFIG = {
    "rooms": {
        "R1": 30,
        "R2": 50,
        "R3": 40,
        "R4": 60,
        "R5": 35,
    },
    "timeslots": ["T1", "T2", "T3", "T4", "T5"],
    "lecturers": ["Alice", "Bob", "Charlie", "David", "Eva", "Frank"],
    "lecturer_preferences": {
        "Alice": {"preferred": ["T1", "T2"], "unpreferred": ["T5"]},
        "Bob": {"preferred": ["T3"], "unpreferred": ["T1"]},
        "Charlie": {"preferred": ["T2", "T3"], "unpreferred": []},
        "David": {"preferred": [], "unpreferred": ["T4", "T5"]},
        "Eva": {"preferred": ["T1"], "unpreferred": ["T3"]},
        "Frank": {"preferred": ["T4", "T5"], "unpreferred": ["T1", "T2"]},
    },
    "lectures": [
        {"id": 1, "course": "Course_1", "allowed_lecturers": [0, 2], "size": 28},
        {"id": 2, "course": "Course_2", "allowed_lecturers": [1, 3, 4], "size": 45},
        {"id": 3, "course": "Course_3", "allowed_lecturers": [0, 1, 5], "size": 38},
        {"id": 4, "course": "Course_4", "allowed_lecturers": [2, 3], "size": 55},
        {"id": 5, "course": "Course_5", "allowed_lecturers": [1, 4, 5], "size": 30},
        {"id": 6, "course": "Course_6", "allowed_lecturers": [0, 3, 4], "size": 25},
        {"id": 7, "course": "Course_7", "allowed_lecturers": [2, 5], "size": 40},
        {"id": 8, "course": "Course_8", "allowed_lecturers": [0, 1, 2], "size": 32},
        {"id": 9, "course": "Course_9", "allowed_lecturers": [3, 4, 5], "size": 58},
        {"id": 10, "course": "Course_10", "allowed_lecturers": [1, 2, 3], "size": 35},
        {"id": 11, "course": "Course_11", "allowed_lecturers": [0, 5], "size": 22},
        {"id": 12, "course": "Course_12", "allowed_lecturers": [1, 3, 5], "size": 48},
        {"id": 13, "course": "Course_13", "allowed_lecturers": [0, 2, 4], "size": 30},
        {"id": 14, "course": "Course_14", "allowed_lecturers": [3, 4], "size": 60},
        {"id": 15, "course": "Course_15", "allowed_lecturers": [1, 2, 5], "size": 36},
    ],
    "gwo_params": {
        "num_wolves": 30,
        "num_iterations": 200,
        "mutation_rate": 0.5,
        "stagnation_limit": 10,
        "num_runs": 5,
        "preference_penalty": 0.5,
        "max_classes_per_lecturer": 5,
    },
    "soft_weights": {
        "preferred_timeslot": 80,
        "unpreferred_timeslot": 70,
        "minimize_gaps": 60,
        "room_utilization": 90,
        "balanced_workload": 50,
        "distribute_classes": 65,
    },
}


def load_config():
    """
    Load configuration from data/config.json.
    Falls back to defaults if file doesn't exist.
    
    Returns a dict with:
        - rooms: dict of room_name -> capacity
        - room_names: list of room names
        - room_caps: list of room capacities (same order as room_names)
        - timeslots: list of timeslot names
        - lecturers: list of lecturer names
        - lecturer_preferences: dict of lecturer_name -> {preferred: [], unpreferred: []}
        - lectures: list of lecture dicts
        - gwo_params: dict of GWO algorithm parameters
    """
    config = DEFAULT_CONFIG.copy()
    
    # Try to load from file
    abs_path = os.path.abspath(CONFIG_PATH)
    if os.path.exists(abs_path):
        try:
            with open(abs_path, "r", encoding="utf-8") as f:
                file_config = json.load(f)
                # Merge with defaults
                config.update(file_config)
                if "gwo_params" in file_config:
                    config["gwo_params"] = {
                        **DEFAULT_CONFIG["gwo_params"],
                        **file_config["gwo_params"],
                    }
                if "soft_weights" in file_config:
                    config["soft_weights"] = {
                        **DEFAULT_CONFIG["soft_weights"],
                        **file_config["soft_weights"],
                    }
            print(f"[Config] Loaded from: {abs_path}")
        except Exception as e:
            print(f"[Config] Error loading config: {e}")
            print("[Config] Using default configuration")
    else:
        print(f"[Config] File not found: {abs_path}")
        print("[Config] Using default configuration")
    
    # Derive convenience lists
    rooms_dict = config["rooms"]
    room_names = list(rooms_dict.keys())
    room_caps = list(rooms_dict.values())
    
    return {
        "rooms": rooms_dict,
        "room_names": room_names,
        "room_caps": room_caps,
        "timeslots": config["timeslots"],
        "lecturers": config["lecturers"],
        "lecturer_preferences": config["lecturer_preferences"],
        "lectures": config["lectures"],
        "gwo_params": config["gwo_params"],
        "soft_weights": config["soft_weights"],
    }


def print_config_summary(cfg):
    """Print a summary of the loaded configuration."""
    print("\n" + "=" * 70)
    print(" CONFIGURATION SUMMARY (from data/config.json)")
    print("=" * 70)
    print(f"Rooms:      {len(cfg['room_names'])} - {', '.join(cfg['room_names'])}")
    print(f"Timeslots:  {len(cfg['timeslots'])} - {', '.join(cfg['timeslots'])}")
    print(f"Lecturers:  {len(cfg['lecturers'])} - {', '.join(cfg['lecturers'])}")
    print(f"Courses:    {len(cfg['lectures'])}")
    print()
    print("Room Capacities:")
    for name, cap in cfg['rooms'].items():
        print(f"  {name}: {cap} students")
    print()
    print("Lecturer Preferences:")
    for name, prefs in cfg['lecturer_preferences'].items():
        print(f"  {name}: preferred={prefs.get('preferred', [])}  unpreferred={prefs.get('unpreferred', [])}")
    print()
    print("GWO Parameters:")
    for key, val in cfg['gwo_params'].items():
        print(f"  {key}: {val}")
    print()
    print("Soft Constraint Weights:")
    for key, val in cfg['soft_weights'].items():
        print(f"  {key}: {val}")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    # Test loading
    cfg = load_config()
    print_config_summary(cfg)
