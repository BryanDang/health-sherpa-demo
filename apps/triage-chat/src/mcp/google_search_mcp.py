import asyncio
import json
import sys
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

# Environment configuration
GOOGLE_SEARCH_API_KEY = os.getenv("GOOGLE_SEARCH_API_KEY")
GOOGLE_CSE_ID = os.getenv("GOOGLE_CSE_ID")

class GoogleSearchClient:
    def __init__(self):
        if not GOOGLE_SEARCH_API_KEY or not GOOGLE_CSE_ID:
            raise ValueError("GOOGLE_SEARCH_API_KEY and GOOGLE_CSE_ID environment variables are required")
        self.api_key = GOOGLE_SEARCH_API_KEY
        self.cse_id = GOOGLE_CSE_ID
        self.base_url = "https://www.googleapis.com/customsearch/v1"

    async def web_search(self, query: str, num_results: int = 5) -> dict:
        params = {
            "key": self.api_key,
            "cx": self.cse_id,
            "q": query,
            "num": num_results
        }
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(self.base_url, params=params)
                response.raise_for_status()  # Raise an exception for 4xx or 5xx responses
                data = response.json()
                
                search_results = []
                if "items" in data:
                    for item in data["items"]:
                        search_results.append({
                            "title": item.get("title"),
                            "link": item.get("link"),
                            "snippet": item.get("snippet")
                        })
                return {"success": True, "results": search_results}
            except httpx.HTTPStatusError as e:
                return {"success": False, "error": f"HTTP error occurred: {e.response.status_code} - {e.response.text}"}
            except httpx.RequestError as e:
                return {"success": False, "error": f"An error occurred while requesting: {e}"}
            except Exception as e:
                return {"success": False, "error": f"An unexpected error occurred: {e}"}

async def handle_request(request_data: dict, client: GoogleSearchClient) -> dict:
    method = request_data.get("method")
    params = request_data.get("params", {})
    request_id = request_data.get("id")

    if method == "web_search":
        query = params.get("query")
        if not query:
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "error": {"code": -32602, "message": "Invalid params: 'query' is required"}
            }
        
        result = await client.web_search(query)
        return {"jsonrpc": "2.0", "id": request_id, "result": result}
    else:
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "error": {"code": -32601, "message": "Method not found"}
        }

async def main():
    client = GoogleSearchClient()
    reader = asyncio.StreamReader()
    protocol = asyncio.StreamReaderProtocol(reader)
    await asyncio.get_event_loop().connect_read_pipe(lambda: protocol, sys.stdin)

    w_transport, w_protocol = await asyncio.get_event_loop().connect_write_pipe(
        asyncio.streams.FlowControlMixin, sys.stdout
    )
    writer = asyncio.StreamWriter(w_transport, w_protocol, None, asyncio.get_event_loop())

    while True:
        line = await reader.readline()
        if not line:
            break

        try:
            request_data = json.loads(line)
            response_data = await handle_request(request_data, client)
        except json.JSONDecodeError:
            response_data = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32700, "message": "Parse error"}
            }
        except Exception as e:
            response_data = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32603, "message": f"Internal error: {e}"}
            }

        response_str = json.dumps(response_data) + '\n'
        writer.write(response_str.encode())
        await writer.drain()

if __name__ == "__main__":
    asyncio.run(main())