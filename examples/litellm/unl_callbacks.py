"""Unl for every model behind a LiteLLM proxy: a pre-call hook adds the person's why to each request.

    config.yaml:
      litellm_settings:
        callbacks: unl_callbacks.proxy_handler_instance
    export UNL_KEY=...   # https://unlimitless.ai/portal/keys
    litellm --config config.yaml
"""
import sys

from litellm.integrations.custom_logger import CustomLogger

sys.path.insert(0, __file__.rsplit("/", 2)[0])
from unl_ask import unl_context  # noqa: E402


class UnlWhy(CustomLogger):
    async def async_pre_call_hook(self, user_api_key_dict, cache, data: dict, call_type):
        messages = data.get("messages")
        if not isinstance(messages, list):
            return data
        last_user = next((m for m in reversed(messages) if m.get("role") == "user"), None)
        query = last_user.get("content") if last_user else ""
        if isinstance(query, list):  # content parts
            query = " ".join(p.get("text", "") for p in query if isinstance(p, dict))
        ctx = unl_context(str(query or ""), model=data.get("model"))
        if ctx:
            n = next((i for i, m in enumerate(messages) if m.get("role") != "system"), len(messages))
            data["messages"] = messages[:n] + [{"role": "system", "content": ctx}] + messages[n:]
        return data


proxy_handler_instance = UnlWhy()
