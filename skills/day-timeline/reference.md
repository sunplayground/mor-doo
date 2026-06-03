# Reference: Day Timeline Output Format

## JSON Output Contract

ตอบเป็น JSON เท่านั้น ห้าม markdown ห้าม text อื่น

```json
{
  "segments": [
    {"start": "00:00", "end": "06:00", "level": "low"},
    {"start": "06:00", "end": "10:00", "level": "moderate"},
    {"start": "10:00", "end": "15:00", "level": "peak"},
    {"start": "15:00", "end": "18:00", "level": "good"},
    {"start": "18:00", "end": "21:00", "level": "moderate"},
    {"start": "21:00", "end": "24:00", "level": "low"}
  ],
  "peakStart": "10:00",
  "peakEnd": "15:00"
}
```

## กฎ
- segments ต้องครอบคลุม 00:00 ถึง 24:00 โดยไม่มีช่องว่าง
- แต่ละ segment ต้องมี start, end, level
- peakStart และ peakEnd คือช่วง peak ที่ดีที่สุด (ถ้ามีหลาย peak ให้เลือกอันที่ดีสุด)
- time format: HH:MM เท่านั้น
- level values: peak, good, moderate, low, caution
