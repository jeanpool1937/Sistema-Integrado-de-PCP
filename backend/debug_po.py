
import sys
import os
import logging

# Configure logging to stdout
logging.basicConfig(level=logging.INFO, stream=sys.stdout)

print(f"Current working directory: {os.getcwd()}")
print(f"Script location: {os.path.abspath(__file__)}")

# Add current directory to path to ensure we import local sync_utils
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import sync_utils
print(f"Imported sync_utils from: {sync_utils.__file__}")

from daily_sync import DEMANDA_FILE
print(f"Demanda File: {DEMANDA_FILE}")

print("Calling sync_demanda_proyectada...")
sync_utils.sync_demanda_proyectada(DEMANDA_FILE)
print("Done.")
