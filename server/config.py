"""Simple configuration settings"""
import os
from dotenv import load_dotenv

load_dotenv()

# API Keys
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

# Server settings
SERVER_HOST = os.getenv("SERVER_HOST", "0.0.0.0")
SERVER_PORT = int(os.getenv("SERVER_PORT", "8000"))

# Model settings
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4o-mini")
MODEL_TEMPERATURE = float(os.getenv("MODEL_TEMPERATURE", "0"))

# Tool settings
TAVILY_MAX_RESULTS = int(os.getenv("TAVILY_MAX_RESULTS", "3"))

