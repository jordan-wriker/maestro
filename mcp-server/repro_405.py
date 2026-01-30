import httpx
import asyncio

async def test_endpoint():
    # Attempt to hit the clear session endpoint on the running server
    async with httpx.AsyncClient() as client:
        url = "http://localhost:8001/api/admin/clear-session/test-session-repro"
        response = await client.post(url)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 405:
            print("Reproduced 405 Method Not Allowed")
            
            # Check if GET works (just to see if it hits the SPA catch-all)
            print("Testing GET equivalent...")
            resp_get = await client.get(url)
            print(f"GET Status: {resp_get.status_code}")
            # If SPA catch-all is hitting, it might return 404 because of the api/ check inside it
            
            # Check if OPTIONS works
            print("Testing OPTIONS...")
            resp_opt = await client.options(url)
            print(f"OPTIONS Status: {resp_opt.status_code}")

if __name__ == "__main__":
    asyncio.run(test_endpoint())
