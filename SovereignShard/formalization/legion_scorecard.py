import json
import requests
import time

def generate_snipe_score(token_address, consensus_rating, rug_risk):
    # Porting the XVARY logic to Solana
    quant_score = (1.0 - rug_risk) * 0.4
    qual_score = consensus_rating * 0.6
    final_score = quant_score + qual_score
    
    status = "RESONANT" if final_score > 0.8 else "STABLE" if final_score > 0.4 else "DECOHERENT"
    
    return {
        "address": token_address,
        "snipe_score": round(final_score, 2),
        "status": status,
        "clades": {
            "quant": round(quant_score, 2),
            "qual": round(qual_score, 2)
        }
    }

if __name__ == "__main__":
    # Example scorecard for a new listing
    print(json.dumps(generate_snipe_score("SoV1...xyz", 0.85, 0.05), indent=2))
