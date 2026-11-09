variable "TAG" { default = "ubuntu26.04" }
variable "NODE_IMAGE" { default = "" }
variable "UBUNTU_IMAGE" { default = "ubuntu:26.04@sha256:6a06111c3b0a8600feadb270aec771dc239bf407b25625f93f44ab00e11f4d3c" }
variable "NODE_DIST_IMAGE" { default = "node:24.22.2-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9" }
variable "PLATFORMS" { default = ["linux/arm64"] }

group "default" { targets = ["node24", "smtp", "imap", "webmail", "proxy"] }
target "node24" {
  context = "platform/node24"
  dockerfile = "Dockerfile"
  args = { UBUNTU_IMAGE = UBUNTU_IMAGE, NODE_DIST_IMAGE = NODE_DIST_IMAGE }
  tags = ["mailbox-node24:${TAG}"]
  platforms = PLATFORMS
  output = ["type=docker"]
}
target "node-consumer" {
  args = { NODE_IMAGE = NODE_IMAGE == "" ? "node_runtime" : NODE_IMAGE }
  contexts = NODE_IMAGE == "" ? { node_runtime = "target:node24" } : {}
  platforms = PLATFORMS
  output = ["type=docker"]
}
target "smtp" {
  inherits = ["node-consumer"]
  context = "smtp-receiver"
  tags = ["mailbox-smtp-receiver:${TAG}"]
}
target "webmail" {
  inherits = ["node-consumer"]
  context = "webmail-ui"
  tags = ["mailbox-webmail-ui:${TAG}"]
}
target "imap" {
  context = "imap-mailbox"
  args = { UBUNTU_IMAGE = UBUNTU_IMAGE }
  tags = ["mailbox-imap-mailbox:${TAG}"]
  platforms = PLATFORMS
  output = ["type=docker"]
}
target "proxy" {
  context = "webmail-ui"
  dockerfile = "Dockerfile.proxy"
  args = { UBUNTU_IMAGE = UBUNTU_IMAGE }
  tags = ["mailbox-webmail-proxy:${TAG}"]
  platforms = PLATFORMS
  output = ["type=docker"]
}
