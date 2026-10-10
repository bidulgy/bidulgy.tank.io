'use strict';

// AWS App Runner 배포가 끝나면 아래 값을 발급된 HTTPS 주소의 WSS 버전으로 교체합니다.
// 예: https://abc.ap-northeast-2.awsapprunner.com -> wss://abc.ap-northeast-2.awsapprunner.com/arena-ws
window.TANK_ARENA_WS_URL = window.TANK_ARENA_WS_URL || '';
