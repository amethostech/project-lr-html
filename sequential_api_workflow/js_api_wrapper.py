import subprocess
import json
import os
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for debugging
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BRIDGE_SCRIPT_PATH = os.path.join(os.path.dirname(__file__), 'bridge_script.js')

class SearchRequest(BaseModel):
    api_name: str
    query: str
    params: Optional[Dict[str, Any]] = {}

def call_js_api(api_name, query, **kwargs):
    """
    Calls the Node.js bridge script to execute the API request.
    
    Args:
        api_name (str): Name of the API (PubMed, PubChem, USPTO, PatentsView).
        query (str): The main query string (keywords).
        **kwargs: Additional parameters for specific APIs.
    
    Returns:
        dict: The JSON result from the API.
    """
    
    payload = {
        "api": api_name,
        "params": {
            "query": query,
            **kwargs
        }
    }

    try:
        # Run the node script
        process = subprocess.Popen(
            ['node', BRIDGE_SCRIPT_PATH],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        stdout, stderr = process.communicate(input=json.dumps(payload))
        
        # Always print stderr for debugging
        if stderr:
            print(f"BRIDGE STDERR: {stderr}")
        
        if process.returncode != 0:
            raise Exception(f"Node script execution failed: {stderr}")
            
        try:
            response = json.loads(stdout)
        except json.JSONDecodeError:
            raise Exception(f"Invalid JSON from Node script: {stdout}")

        if not response.get('success'):
            raise Exception(f"API Error: {response.get('error')}")

        return response.get('data')

    except Exception as e:
        print(f"Error calling {api_name}: {e}")
        return {"results": [], "error": str(e)}

from patentsview_service import search_patents
from keyword_extractor import extract_keywords

class KeywordExtractionRequest(BaseModel):
    data: list
    source: str

@app.post("/api/search")
async def search_endpoint(request: SearchRequest):
    try:
        kwargs = request.params
        print(f"DEBUG: Received Request - API: {request.api_name}, Query: {request.query}, Params: {kwargs}")
        
        if request.api_name.upper() == "USPTO":
            start_year = int(kwargs.get('start_year')) if kwargs.get('start_year') else None
            end_year = int(kwargs.get('end_year')) if kwargs.get('end_year') else None
            
            result = search_patents(
                keywords=request.query,
                start_year=start_year,
                end_year=end_year,
                size=100
            )
            return {"results": result['results'], "total": result.get('total', len(result['results']))}
        
        results = call_js_api(request.api_name, request.query, **kwargs)
        
        if isinstance(results, dict) and 'results' in results:
            return {"results": results['results'], "total": results.get('total', len(results['results']))}
        
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/extract-keywords")
async def extract_keywords_endpoint(request: KeywordExtractionRequest):
    try:
        print(f"DEBUG: Extracting keywords from {len(request.data)} items, source: {request.source}")
        keywords_str = extract_keywords(request.data, request.source)
        keywords_list = [k.strip() for k in keywords_str.split(",") if k.strip()]
        print(f"DEBUG: Extracted keywords: {keywords_list}")
        return {"keywords": keywords_list, "count": len(keywords_list)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
