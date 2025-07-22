# Page snapshot

```yaml
- banner:
  - heading "XOB CAT" [level=1]
  - paragraph: XO Bot Conversation Analysis Tools
- main:
  - heading "Sessions" [level=1]
  - paragraph: Browse and analyze chatbot session data
  - text: Filters Filter sessions by date, time, and other criteria (Eastern Time) Start Date
  - textbox "Start Date"
  - text: End Date
  - textbox "End Date"
  - text: Start Time
  - textbox "Start Time"
  - text: End Time
  - textbox "End Time"
  - button "Filter"
  - text: Session Overview 1 sessions found
  - table:
    - rowgroup:
      - row "Session ID Start Time ↓ Duration Containment Type":
        - cell "Session ID":
          - button "Session ID"
        - cell "Start Time ↓":
          - button "Start Time ↓"
        - cell "Duration":
          - button "Duration"
        - cell "Containment Type":
          - button "Containment Type"
    - rowgroup:
      - row "session_test_123 07/21/2025, 06:00:00 AM ET 5m 0s Agent":
        - cell "session_test_123"
        - cell "07/21/2025, 06:00:00 AM ET"
        - cell "5m 0s"
        - cell "Agent"
- alert: XOB CAT - XO Bot Conversation Analysis Tools
```