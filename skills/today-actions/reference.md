# Reference: Today Actions Output Format

## JSON Output Contract

ตอบเป็น JSON เท่านั้น ห้าม markdown ห้าม text อื่น

```json
{
  "actions": [
    {
      "id": "call",
      "energy": "good",
      "desc": "จังหวะดี ดาวอังคารหนุนการติดต่อ มีโอกาสสำเร็จสูง",
      "time": "ถึง 12:15"
    },
    {
      "id": "present",
      "energy": "moderate",
      "desc": "ผลตอบรับดี แต่ยังไม่ใช่วันปิดดีล",
      "time": "10:00–15:45"
    },
    {
      "id": "sign",
      "energy": "bad",
      "desc": "ดาวเสาร์ทับ House 7 — เลื่อนออกไปก่อนดีกว่า",
      "time": "หลีกเลี่ยงวันนี้"
    },
    {
      "id": "text",
      "energy": "good",
      "desc": "พุธเสริมการสื่อสาร ข้อความที่ส่งวันนี้จะได้รับการตอบกลับ",
      "time": "ถึง 14:00"
    },
    {
      "id": "buy",
      "energy": "moderate",
      "desc": "ซื้อของใช้ทั่วไปได้ แต่ยังไม่ใช่วันลงทุนใหญ่",
      "time": "ทั้งวัน"
    },
    {
      "id": "reject",
      "energy": "bad",
      "desc": "ยังไม่ใช่เวลา การปฏิเสธวันนี้อาจทำให้ความสัมพันธ์บาดหมาง",
      "time": "ทั้งวัน"
    }
  ]
}
```

## กฎ
- ต้องมีครบทุก id: call, present, sign, text, buy, reject
- ห้าม good ทุกตัว — ต้องมีความหลากหลาย สะท้อน natal chart จริง
- desc ต้องเฉพาะเจาะจง ห้ามใช้ประโยคทั่วไปที่ใครก็ได้
- time ต้องเป็น HH:MM format หรือ "ทั้งวัน" หรือ "หลีกเลี่ยงวันนี้"
