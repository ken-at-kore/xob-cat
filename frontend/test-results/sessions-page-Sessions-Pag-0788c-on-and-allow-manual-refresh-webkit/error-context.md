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
  - text: Session Overview 0 sessions found
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
    - rowgroup
  - paragraph: No sessions found matching your filters.
- alert
```