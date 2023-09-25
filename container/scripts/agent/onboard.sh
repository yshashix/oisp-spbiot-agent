#!/bin/bash
# Author: Marcel Wagner
# Brief: Script to setup a new device
# Description: Dependend on Environment variables it will activate/re-activate and register components
# Environemnt:
# - OISP_DEVICE_ACTIVATION_CODE if defined and device is not yet activated, it will activate using the code in
#                        the variable
# - OISP_DEVICE_ID the device id for activation
# - OISP_DEVICE_NAME the device name for activation
# - OISP_FORCE_REACTIVATION if set to "true" it will initialize the device and activate again with the code in OISP_ACTIVATION_CODE

# How can I check whether device is activated? There is only a test for connectivity
# For the time being, it checks whether device has a token.

function fail {
    echo $1
    exit 1
}

# Return: token
function exchange_onboarding_token() {
        curl -X POST "${KEYCLOAK_URL}/${NAMESPACE}/protocol/openid-connect/token" \
            -d "client_id=${ONBOARDING_CLIENT_ID}" \
            -d "grant_type=urn:ietf:params:oauth:grant-type:token-exchange" \
            -d "subject_token=${onboarding_token}" \
            -d "requested_token_type=urn:ietf:params:oauth:token-type:refresh_token" \
            -d "audience=${DEVICE_CLIENT_ID}" \
            -H "X-DeviceID: ${DEVICE_ID}" \
            -H "X-GatewayID: ${GATEWAY_ID}" \
            -H "X-Access-Type: device" \
            | jq ".access_token" | tr -d '"'
}

DATADIR=../../../data
CONFDIR=../../../config
ADMIN=../../../oisp-admin.js

echo onboarding with OISP_DEVICE_ACTIVATION_CODE=${OISP_DEVICE_ACTIVATION_CODE} OISP_DEVICE_ID=${OISP_DEVICE_ID} OISP_FORCE_REACTIVATION=${OISP_FORCE_REACTIVATION} OISP_DEVICE_NAME=${OISP_DEVICE_NAME} OISP_GATEWAY_ID=${OISP_GATEWAY_ID}
TOKEN=$(cat ${DATADIR}/device.json | jq ".device_token")
echo Token found: $TOKEN
if [ -z "$TOKEN" ] || [ "$TOKEN" = "\"\"" ] || [ "$TOKEN" = "false" ] || [ ! -z "$OISP_FORCE_REACTIVATION" ]; then
    if [ -z "$OISP_DEVICE_ACTIVATION_CODE" ]; then
        fail "No Device Activation Code given but no token found or reactivation is forced"
    fi
    ${ADMIN} test
    ${ADMIN} initialize
    if [ ! -z "$OISP_DEVICE_ID" ]; then
        ${ADMIN} set-device-id $OISP_DEVICE_ID
    else
        fail "No device id given"
    fi
    if [ ! -z "$OISP_DEVICE_NAME" ]; then
        ${ADMIN} set-device-name $OISP_DEVICE_NAME
    fi
    if [ ! -z "$OISP_GATEWAY_ID" ]; then
	${ADMIN} set-gateway-id $OISP_GATEWAY_ID
    else
        fail "No gateway id given"
    fi
    
    onboarding_token=$(exchange_onboarding_token) || fail "Could not onboard device"
    echo onboarding tokern is =$onboarding_token 
fi
