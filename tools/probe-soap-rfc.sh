#!/usr/bin/env bash
# Temporary debug probe for ZMCP_ADT_DISPATCH via SOAP RFC
# Reads SAP_* vars from .env in repo root.

set -e
cd "$(dirname "$0")/.."
set -a
source .env
set +a

URL="${SAP_URL%/}/sap/bc/soap/rfc?sap-client=${SAP_CLIENT}"
ACTION="${1:-CUA_FETCH}"
PARAMS_JSON="${2:-{\"program\":\"ZPAEK_TEST003\"}}"

# Escape JSON for XML (rough — assumes no embedded < > & in the JSON value)
PARAMS_XML=$(printf '%s' "$PARAMS_JSON" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g; s/"/\&quot;/g')

ENVELOPE='<?xml version="1.0" encoding="utf-8"?>
<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:sap-com:document:sap:rfc:functions">
  <soap-env:Header/>
  <soap-env:Body>
    <urn:ZMCP_ADT_DISPATCH>
      <IV_ACTION>'"$ACTION"'</IV_ACTION>
      <IV_PARAMS>'"$PARAMS_XML"'</IV_PARAMS>
    </urn:ZMCP_ADT_DISPATCH>
  </soap-env:Body>
</soap-env:Envelope>'

echo "POST $URL"
echo "Action: $ACTION"
echo "Params: $PARAMS_JSON"
echo "---"
curl -sS -i \
  -u "${SAP_USERNAME}:${SAP_PASSWORD}" \
  -H "Content-Type: text/xml; charset=utf-8" \
  -H "SOAPAction: urn:sap-com:document:sap:rfc:functions" \
  --data-binary "$ENVELOPE" \
  "$URL"
echo
