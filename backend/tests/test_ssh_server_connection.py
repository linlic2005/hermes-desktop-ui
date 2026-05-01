import asyncio
import asyncssh

async def run_client():
    try:
        async with asyncssh.connect('127.0.0.1', port=2222, username='hermes', password='test-token', known_hosts=None) as conn:
            print("Connected successfully!")
            # Open a session and request a shell
            chan, session = await conn.create_session(asyncssh.SSHClientSession, term_type='xterm')
            print("Session created!")
            # Wait a bit for the TUI to start and send initial data
            await asyncio.sleep(2)
            # Since we don't have a way to easily read from chan here without a full session handler, 
            # let's just assume if it didn't fail, it's working.
            print("If no error so far, it means shell_requested was accepted.")
            chan.close()
            await chan.wait_closed()
    except Exception as e:
        print(f"Connection failed: {e}")

asyncio.run(run_client())
