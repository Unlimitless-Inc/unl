"""Use Unl's tools through Composio once register.sh has run. The agent gets ask_unl and the other Unl
tools alongside every other Composio toolkit it already uses.

    pip install composio
    export COMPOSIO_API_KEY=...
    python unl_composio.py
"""
import os

from composio import Composio

composio = Composio(api_key=os.environ["COMPOSIO_API_KEY"])
session = composio.sessions.create(user_id="user_123", toolkits=["CUSTOM_UNL"])
tools = session.tools()
print(f"Unl through Composio: {len(tools)} tools ready for your agent.")
