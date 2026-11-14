# Container packages

릴리스 버전은 루트 `VERSION`과 웹메일 `package.json`/lock의 버전을 함께 갱신한다. 프로젝트 SPDX는 `AGPL-3.0-only`이고 `LICENSE`는 참조한 AGPLv3 원문을 그대로 보존한다. `NOTICE`와 제삼자 고지를 이미지에 포함하며 웹메일 footer의 소스 링크는 이미지의 `SOURCE_REVISION` 전체 SHA를 가리킨다.

## 공개 패키지

- `ghcr.io/junsungkang/mail-server-smtp-receiver`
- `ghcr.io/junsungkang/mail-server-imap-mailbox`
- `ghcr.io/junsungkang/mail-server-webmail-ui`

이름은 기존 registry 소비자와의 호환성을 위해 유지한다. 기존 `v0.1.0`과 웹메일 `v0.1.1`은 덮어쓰지 않는다. 새 릴리스 태그는 `v0.2.0`, `latest`, `sha-<전체 SHA>`이다. 각 릴리스 index는 네이티브 `linux/amd64`, `linux/arm64` 이미지를 포함한다. `build-<workflow run ID>-<arch>`는 검증된 조립용 이미지이며 일반 소비자는 릴리스 태그/digest를 사용한다.

## 빌드

```bash
docker buildx bake -f docker-bake.hcl --print
docker buildx bake -f docker-bake.hcl
```

Node24 target을 SMTP·웹메일이 함께 사용하며 다른 프로젝트의 공통 tag를 덮어쓰지 않는다. `TAG`, `VERSION`, `SOURCE_REVISION`, `PLATFORMS`, `NODE_IMAGE`를 Bake 변수로 조정할 수 있다. 외부 base를 지정하는 경우에도 Ubuntu26.04·Node24와 필요한 native crypto 기능을 유지한다.

모듈 Dockerfile은 `license_files` named context를 요구한다. 루트 `.dockerignore`는 전체를 제외한 뒤 `LICENSE`, `NOTICE`만 허용한다. 루트 `.env`, 메일, 계정, 인증서, Git·작업 자료가 이 context에 들어가지 않는다. 세 Compose에도 동일한 additional context를 지정한다. 직접 Dockerfile을 빌드할 때는 프로젝트 루트에서 `--build-context license_files=.`를 함께 전달한다.

배포 버전의 `SOURCE_REVISION`은 공개한 정확한 소스 commit의 전체40자리 SHA로 설정한다. 미지정/유효하지 않은 development revision은 main archive를 가리킨다. 수정한 서버를 공개 운영할 때는 그 수정 소스를 공개한 SHA로 빌드해 대응 소스를 제공한다.

## 검증

검증 디렉터리는 checkout 내부에 만들고 `CHECK_DIR`에 지정한다. `TAG`는 검사할 로컬 이미지 tag, `EXPECTED_ARCHITECTURE`는 `amd64` 또는 `arm64`다. 이미지를 해당 설정으로 빌드한 뒤 다음을 실행한다.

```bash
node tests/release/check.mjs
node tests/release/check.mjs --images
node tests/release/unit.mjs
node tests/release/smoke.mjs
node tests/release/scan.mjs
```

검사는 버전·SPDX·원문 hash·OCI label·내장 LICENSE, native runtime/기능, 단위 테스트와 별도 내부 네트워크의 SMTP/IMAP/Webmail fixture를 확인한다. 서비스 계정 선점·전달 헤더 위조 거부, 코드 없는 가입, 비밀번호 호환, TLS/CA/호스트·SASL, 로컬 메일 배달, 소스 링크와 정상 재시작을 검사한다. 실제 운영 계정·volume을 선택하거나 외부 실제 수신자에게 메일을 보내지 않는다. fixture가 끝나면 정확히 생성한 컨테이너·볼륨·네트워크·테스트 자격을 제거한다.

Trivy는 digest를 고정한 scanner와 최신 DB를 사용하며 severity/미수정 항목을 숨기지 않는다. image archive→manifest→config→scan의 연결을 확인하고 HIGH/CRITICAL이 있으면 게시를 중단한다. 남은 severity는 raw report에 기록한다. 검사기는 OCI archive와 Docker archive 및 두 native architecture를 지원한다.

## 게시 흐름

1. 사람 feature PR → 독립 App current-head 승인·필수 검사 → develop 통합.
2. main의 기존 이력을 보존한 별도 release PR → 같은 승인·검사 → main 병합과 feature branch 정리.
3. main의 `VERSION`/게시 workflow 변경 또는 main에서 수동 실행 시 `Publish containers`가 시작된다. 임의 source ref 입력과 fork/PR 게시 경로는 없다.
4. 두 native runner가 동일한 SHA를 빌드하고 검증·scan을 마친 뒤 architecture별 조립용 tag를 게시한다.
5. 두 작업 모두 성공해야 조립한다. 모든 package의 양쪽 architecture·revision·license·버전을 검증한 뒤 버전/SHA index를 만들고, 세 index 검증 후 `latest`를 옮긴다.

동시 게시를 직렬화하며 게시 전 현재 main SHA를 다시 조회해 오래된 실행이 최신 태그를 덮어쓰지 못하게 한다. 이미 존재하는 버전/SHA 태그를 다른 구성이나 revision으로 바꾸는 작업은 거부한다. 새 소스 릴리스에는 버전을 올린다. 서로 다른 세 registry 이름의 태그 변경은 단일 트랜잭션이 아니므로 최종 `published.json`의 세 digest 검증을 완료 기준으로 사용한다.

사람의 기존 GitHub 세션은 commit/push/PR/merge에 사용하고 App은 formal review를 수행한다. registry 게시에는 workflow 저장소의 단기 `GITHUB_TOKEN`과 `contents: read`, `packages: write`만 사용한다. PAT나 App private key를 저장소·로그·명령 인자로 넣지 않는다. checkout credential을 보존하지 않고 검증 artifact에는 지정한 reports 디렉터리만 포함한다.

GitHub의 기존 package가 현재 저장소에 Actions 접근 권한을 부여하지 않았다면 push가 거부될 수 있다. 이 경우 실제 권한 오류를 확인하고 해당 package의 Actions 접근을 설정해야 한다. 다른 저장소나 다른 이름의 새 package로 우회하지 않는다.

workflow artifact의 `published.json`과 공개 GHCR manifest/config에서 최종3개 image digest·source SHA·버전·SPDX·두 architecture를 확인한다. 패키지 갱신은 운영 컨테이너의 자동 교체를 뜻하지 않으며, 실제 데이터 교체는 기존 [운영 절차](operation.md)를 별도로 따른다.

공식 참고: [AGPLv3](https://www.gnu.org/licenses/agpl-3.0.html), [SPDX AGPL-3.0-only](https://spdx.org/licenses/AGPL-3.0-only.html), [GitHub Container registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry), [Bake named contexts](https://docs.docker.com/build/bake/contexts/).
