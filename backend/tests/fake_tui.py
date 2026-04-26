import signal
import sys
import time


def write(text: str) -> None:
    sys.stdout.write(text)
    sys.stdout.flush()


def handle_interrupt(signum, frame):
    write("\r\n\x1b[31minterrupted\x1b[0m\r\n")


signal.signal(signal.SIGINT, handle_interrupt)

write("\x1b[36mHermes Fake TUI\x1b[0m\r\n")
write("\x1b[32mready\x1b[0m\r\n")

while True:
    line = sys.stdin.readline()
    if line == "":
        break
    command = line.strip()
    if command == "hello":
        write("\x1b[35mYou said: hello\x1b[0m\r\n")
    elif command == "/help":
        write("\x1b[33mCommands\x1b[0m\r\n  Chat: /new /resume\r\n  System: /usage /model\r\n  Extensions: /skills\r\n")
    elif command == "/usage":
        write("\x1b[34mUsage\x1b[0m\r\ninput: 100\r\noutput: 200\r\n")
    elif command == "/skills":
        write("\x1b[32mSkills\x1b[0m\r\n- code-review enabled\r\n- docs enabled\r\n")
    elif command == "/model":
        write("\x1b[36mModels\x1b[0m\r\n> default\r\n  fast\r\n")
    elif command == "/sessions":
        write("\x1b[36mSessions\x1b[0m\r\n- fake-session-1\r\n")
    elif command == "longrun":
        for i in range(10):
            write(f"\x1b[90mstream line {i}\x1b[0m\r\n")
            time.sleep(0.05)
    elif command:
        write(f"You said: {command}\r\n")
