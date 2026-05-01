# AGENTS

이 프로젝트는 CRM 프로젝트와 동일한 패키징 원칙을 따른다.

- 소스는 `source/apps` 아래 서비스별로 둔다.
- 배포 compose와 env 템플릿은 `source/deploy` 아래에 둔다.
- 납품 문서는 `source/docs` 아래에 둔다.
- 릴리즈 패키지는 `source/scripts/package/build-release.sh`로 생성한다.
- 생성된 release 패키지에는 소스 코드를 포함하지 않는다.
