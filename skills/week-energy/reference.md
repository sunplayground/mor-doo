# Reference: Week Energy Output Format

## JSON Output Contract

ตอบเป็น JSON เท่านั้น ห้าม markdown ห้าม text อื่น

```json
{
  "week": [
    {"date": "YYYY-MM-DD", "energy": "good"},
    {"date": "YYYY-MM-DD", "energy": "moderate"},
    {"date": "YYYY-MM-DD", "energy": "challenging"},
    ...7 วัน
  ]
}
```

## energy values
- `"good"` — วันพลังงานดี เหมาะลงมือทำสิ่งสำคัญ
- `"moderate"` — วันพลังงานปานกลาง ทำงานประจำได้ดี แต่ไม่ใช่วันเริ่มต้นสิ่งใหม่
- `"challenging"` — วันที่ดาวท้าทาย ควรระวัง ไม่ใช่วันตัดสินใจใหญ่

## กฎ
- ต้องมีครบ 7 วัน ตามวันที่ที่ระบุใน prompt
- date format: YYYY-MM-DD เท่านั้น
- ห้ามเพิ่ม field อื่นนอกจาก date และ energy
- ห้าม good ทุกวัน และห้าม challenging ทุกวัน — ต้องมีความหลากหลาย
