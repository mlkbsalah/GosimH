import json

from phase2 import run_phase2
from phase3 import run_phase3



def main():
    phase1 = {
        "type":             "microwave",
        "brand":            "Sharp",
        "model":            "R-354",
        "serial":           None,
        "error_code":       None,
        "visible_symptoms": [
            "no longer heats food",
            "turntable still spins",
            "light works",
            "makes a buzzing noise when running"
        ],
        "confidence": 0.75,
    }
    phase2 = run_phase2(phase1)
    phase3 = run_phase3(phase2)

    print("================================== FIN ===============================================")
    print("Phase2")
    print(json.dumps(phase2, ensure_ascii=False, indent=2))
    print("Phase3")
    print(json.dumps(phase3, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()