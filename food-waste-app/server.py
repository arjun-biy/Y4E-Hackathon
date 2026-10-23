"""Serves the app on localhost with browser caching off, so a normal reload always gets the latest files."""
import http.server
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


http.server.test(HandlerClass=NoCache, port=int(sys.argv[1]) if len(sys.argv) > 1 else 8100)
