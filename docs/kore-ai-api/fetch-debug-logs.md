# Debug Logs API

To fetch debug logs of a specific conversation.

## API Details

| Property | Value |
|----------|-------|
| **Method** | GET |
| **Endpoint** | `https://{{host}}/api/{{version}}/{{BotID}}/debuglogs?identity={{identity}}&channelType={{channelType}}&minimumInfo=true&limit=5&offset=300&timezone={{timezone}}` |
| **Content Type** | `application/json` |
| **Authorization** | JWT Token `auth: {{JWT}}` |
| **API Scope** | App Builder: Debug Logs |

## Path Parameters

| Parameter | Description |
|-----------|-------------|
| `host` | Environment URL, for example, https://platform.kore.ai |
| `BotID` | Bot ID. You can access it from the General Settings page of the bot |

## Sample Request

```bash
curl -X GET \
   'https://{{host}}/api/1.1/{{BotID}}/debuglogs?identity={{id}}&channelType=ivrVoice&minimumInfo=true&limit=5&offset=300&timezone=America/New_York' \  
  -H 'auth: {{YOUR_JWT_ACCESS_TOKEN}}' \
```

## Query Parameters

| Parameter | Description |
|-----------|-------------|
| `version` | Refers to the version of the API. The current version of this API is "1.1" |
| `identity` | Unique ID associated with the call. For SmartAssist channel, identity = {accountId}/smartassist/{sessionId} |
| `channel` | Name of the channel through which the conversation is initiated. The default is 'rtm'. Accepted values are: `rtm`, `ivrVoice`, `audiocodes`, `smartassist`, `genericsms`, `twiliosms`, `genesys` |
| `minimumInfo` | Optional field. Set to 'true' to get only the summary |
| `offset` | Specify the page number from which to start fetching the logs. If unspecified, it starts from 0, which is the first page of the list of logs |
| `limit` | The number of records to fetch. The maximum applicable limit is 50 |
| `timezone` | Timezone for the logs (e.g., `America/New_York`) |
| `fromDate` | Date from which the logs are requested, valid formats: yyyy-mm-dd or valid timestamp |
| `toDate` | Date up to which the logs are requested, valid formats: yyyy-mm-dd or valid timestamp |

## Sample Responses

### IVR Channel

```json
[
  {
    "timestamp": "2018-11-22T13:06:17.258Z",
    "nomatch_count": "0",
    "noinput_count": "1",
    "debugTitle": "Bing",
    "debugLevel": "Info",
    "debugMessage": "intent node initiated",
    "metaInfo": {
      "channel": "ivrVoice",
      "identity": "Nov22PilotEnv1"
    }
  },
  {
    "timestamp": "2018-11-22T13:06:17.258Z",
    "debugTitle": "Bing",
    "debugLevel": "Info",
    "debugMessage": "intent node processing is completed",
    "metaInfo": {
      "channel": "ivrVoice",
      "identity": "Nov22PilotEnv1"
    }
  },
  {
    "timestamp": "2018-11-22T13:07:54.395Z",
    "debugTitle": "Company: Reached end of dialog",
    "debugLevel": "Info",
    "metaInfo": {
      "channel": "ivrVoice",
      "identity": "Nov22PilotEnv1"
    }
  }
]
```

### SmartAssist Channel

```json
{
  "timestamp": "2024-08-14T23:18:10.920Z",
  "debugTitle": "Why_Calling_Eligibility_and_Benefits",
  "debugMessage": "intent node processing is completed",
  "debugLevel": "Info",
  "metaInfo": {
    "channel": "smartassist",
    "identity": "66043a5df09690986395xxxx/smartassist/66bd3afa5e3e64268aaaxxxx"
  },
  "VGdebugDetail": {
    "inputType": "voice",
    "inputMessage": "If you're a member and need help with your health plan, say I'm a member. Otherwise, in a few words, tell me why you're calling today.",
    "ASRVendor": "microsoft"
  }
}
```

### SMS Channel

```json
[
  {
    "timestamp": "2025-05-27T04:36:17.296Z",
    "debugTitle": "welcomedialog",
    "debugMessage": "intent node processing is completed",
    "debugLevel": "Info",
    "metaInfo": {
      "channel": "sms",
      "identity": "67e125c59ec655b7448eb65b/+12566020200"
    }
  },
  {
    "timestamp": "2025-05-27T04:36:17.334Z",
    "debugTitle": "menuCheck",
    "debugMessage": "Script node execution successful",
    "debugLevel": "info",
    "debugDetail": "{\"title\":\" \",\"body\":\"\",\"updatedContext\":{\"bot\":\"Master Bot Flow\",\"botid\":\"st-bebdb320-9f69-561d-aeb0-c45169ad33b5\"}}",
    "metaInfo": {
      "channel": "sms",
      "identity": "67e125c59ec655b7448eb65b/+12566020200"
    }
  }
]
```
