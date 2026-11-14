# MailBox platform images

`node24/Dockerfile`은 프로젝트 전용 Ubuntu26.04/Node24 fallback이며 공통 태그를 덮어쓰지 않는다. 루트 `docker-bake.hcl`이 이를 한 번 빌드하고 SMTP/Webmail에 같은 build context로 제공한다. `NODE_IMAGE`로 검증된 외부 Ubuntu26.04/Node24 base를 지정할 수도 있다.

현재 daemon의 ARM64가 기본이다. 운영 compose는 `platform` 프로젝트와 `mailbox-*` 서비스, 다섯 existing external volume을 사용한다. standalone 빌드/실행은 checkout 루트에서 한다. 실제 데이터 교체·보안 결과·client endpoint·복구는 [전환 안내](../docs/developer/guides/ubuntu-platform-transition.md)를 따른다.
