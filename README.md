# PharmaChain

Blockchain-based pharmaceutical supply chain verification.

| Part | Member | Repository |
|---|---|---|
| Smart contract | Member 1 | https://github.com/mpujitha09/pharmachain-contracts |
| Backend API | Member 2 | https://github.com/aasiamushtaque-byte/pharmachain-backend |
| Cold-chain sensors | Member 3 | https://github.com/anwashasaha50-commits/pharmachain-sensors |
| Vision service | Member 4 | https://github.com/subhodeepmahakuru-gif/PharmaChain-Counterfeit-Medicine-Detector-Vision-Service- |
| Portal and integration | Member 5 | https://github.com/saheb2004-web/pharmachain-portal |

## Start order
1. Hardhat node (port 8545)
2. Deploy the contract and copy deployed_addresses.json to the shared folder
3. Backend API: python app.py (port 5000)
4. Vision service: python ml_service.py (port 5001)
5. Portal: python portal.py (port 8000)

## Run the portal
pip install -r requirements.txt
python portal.py
Open http://127.0.0.1:8000

## Integration test
python integration_test.py --genuine PATH-TO-GENUINE.png --fake PATH-TO-FAKE.png
