# 효과음·음악 폴더

`<이름>_<번호>.ogg` 형식으로 넣으면 게임이 알아서 불러옵니다(`.wav`, `.mp3`도 가능). 예: `arrow_hit_1.ogg`, `arrow_hit_2.ogg`.
이름 목록과 제작 문구는 `docs/asset-prompts.md` 10장, 코드 쪽 설정(음량·간격·동시 개수)은 `shared/src/audio.ts`.
파일이 없는 소리는 조용히 건너뜁니다.
