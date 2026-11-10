## Running a proxy server using mitmproxy

Install mitmproxy:

```bash
brew install mitmproxy
```

Run mitmproxy via ui

```bash
mitmweb
```

Then use env vars to set the proxy:

```bash
export PROXY_CERT_FILE=~/.mitmproxy/mitmproxy-ca-cert.pem
export PROXY_URL=http://localhost:8080
```

Now the app should be able to use the proxy. You can test this by calling any endpoint that makes an external request.

If you want to run chrome traffic through that proxy:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
    --proxy-server="http://localhost:8080"
```
