#!/usr/bin/env python3
"""
test_api.py
-----------
Quick test to verify the API is working and data is being sent correctly.

Run this AFTER starting 'npm run dev' to test the connection.
"""

import requests
import json
import time

API_URL = "http://localhost:3000/api/schedule"

def test_api():
    """Test the API by sending sample schedule data."""
    
    print("[TEST] Starting API test...")
    print(f"[TEST] Target API: {API_URL}")
    
    # Sample schedule data
    sample_schedule = [
        {
            "lecture_id": "CS101_001",
            "course_code": "CS101",
            "course_name": "Introduction to Programming",
            "lecturer": "Dr. Ali",
            "room": "R1",
            "timeslot": "08:00-09:30",
            "day": "Monday"
        },
        {
            "lecture_id": "CS101_002",
            "course_code": "CS101",
            "course_name": "Introduction to Programming",
            "lecturer": "Dr. Fatima",
            "room": "R2",
            "timeslot": "09:30-11:00",
            "day": "Monday"
        },
        {
            "lecture_id": "MATH201_001",
            "course_code": "MATH201",
            "course_name": "Calculus I",
            "lecturer": "Dr. Mohammed",
            "room": "R3",
            "timeslot": "11:00-12:30",
            "day": "Tuesday"
        },
        {
            "lecture_id": "PHYS101_001",
            "course_code": "PHYS101",
            "course_name": "Physics I",
            "lecturer": "Dr. Sara",
            "room": "R1",
            "timeslot": "08:00-09:30",
            "day": "Tuesday"
        },
    ]
    
    payload = {
        "schedule": sample_schedule,
        "metadata": {
            "total_lectures": len(sample_schedule),
            "total_rooms": 3,
            "total_timeslots": 3,
            "total_lecturers": 4,
            "conflicts": 0,
            "iterations": 50,
            "wolves": 15,
            "best_fitness": 0.0001,
            "algorithm": "Test API",
            "soft_preference_warnings": 0,
            "gap_warnings": 1,
            "overload_violations": 0,
            "max_classes_per_lecturer": 5,
            "total_slots": 15,
            "used_slots": 4,
            "utilization_pct": 26.7,
            "workload_penalty": 0.5,
            "distribution_penalty": 0.2,
        },
        "gap_warnings": [
            {
                "lecturer": "Dr. Ali",
                "gap": 1,
                "between": "08:00-09:30 and 11:00-12:30"
            }
        ],
        "utilization_info": [
            {
                "room": "R1",
                "course": "CS101",
                "timeslot": "08:00-09:30",
                "capacity": 30,
                "class_size": 20,
                "waste_pct": 33.3,
                "penalty": 0.1
            }
        ],
        "workload_info": [
            {"lecturer": "Dr. Ali", "classes": 1},
            {"lecturer": "Dr. Fatima", "classes": 1},
            {"lecturer": "Dr. Mohammed", "classes": 1},
            {"lecturer": "Dr. Sara", "classes": 1}
        ],
        "distribution_info": [
            {"timeslot": "08:00-09:30", "classes": 2},
            {"timeslot": "09:30-11:00", "classes": 1},
            {"timeslot": "11:00-12:30", "classes": 1}
        ],
        "soft_weights": {
            "preferred_timeslot": 80,
            "unpreferred_timeslot": 70,
            "minimize_gaps": 60,
            "room_utilization": 90,
            "balanced_workload": 50,
            "distribute_classes": 65
        }
    }
    
    # Test POST
    print("\n[TEST] Sending POST request with sample data...")
    try:
        response = requests.post(API_URL, json=payload, timeout=5)
        print(f"[TEST] Response status: {response.status_code}")
        print(f"[TEST] Response body: {response.json()}")
        
        if response.status_code == 200:
            print("✅ POST test PASSED!")
        else:
            print("❌ POST test FAILED!")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to API!")
        print("[TIP] Make sure 'npm run dev' is running on http://localhost:3000")
        return False
    except Exception as e:
        print(f"❌ Error during POST: {e}")
        return False
    
    # Wait a moment for data to be written
    time.sleep(1)
    
    # Test GET
    print("\n[TEST] Sending GET request to retrieve data...")
    try:
        response = requests.get(API_URL, timeout=5)
        print(f"[TEST] Response status: {response.status_code}")
        data = response.json()
        
        print(f"[TEST] Retrieved {len(data.get('schedule', []))} schedule entries")
        print(f"[TEST] Metadata: {data.get('metadata', {})}")
        
        if response.status_code == 200 and len(data.get('schedule', [])) > 0:
            print("✅ GET test PASSED!")
            
            # Show first entry
            if data['schedule']:
                print("\n[TEST] First entry:")
                print(json.dumps(data['schedule'][0], indent=2))
            
            return True
        else:
            print("❌ GET test FAILED!")
            return False
    except Exception as e:
        print(f"❌ Error during GET: {e}")
        return False

def test_ui_connectivity():
    """Test if the UI can be accessed."""
    
    print("\n[TEST] Testing UI connectivity...")
    try:
        response = requests.get("http://localhost:3000", timeout=5)
        if response.status_code == 200:
            print("✅ UI is running on http://localhost:3000")
            return True
        else:
            print(f"❌ UI returned status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to UI on http://localhost:3000")
        print("[TIP] Run 'npm run dev' to start the Next.js server")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("GWO Scheduler - API Test")
    print("=" * 60)
    
    # Test UI first
    ui_ok = test_ui_connectivity()
    
    if not ui_ok:
        print("\n[ABORT] UI is not running. Start it with: npm run dev")
        exit(1)
    
    # Test API
    api_ok = test_api()
    
    if api_ok:
        print("\n" + "=" * 60)
        print("✅ ALL TESTS PASSED!")
        print("=" * 60)
        print("\nYour API is working correctly.")
        print("Now you can run your GWO script and it will update the timetable.")
        print("\nTry: python load_psut_schedule.py")
    else:
        print("\n" + "=" * 60)
        print("❌ TESTS FAILED")
        print("=" * 60)
        print("\nCheck the errors above and make sure:")
        print("1. npm run dev is running")
        print("2. API_URL is correct in your Python script")
        exit(1)
