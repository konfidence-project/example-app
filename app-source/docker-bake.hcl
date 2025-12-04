variable "HUB" {
  default = "konfidence.common.repositories.cloud.sap/example-app-tests/apps"
}

variable "PLATFORMS" {
  default = "linux/amd64,linux/arm64"
}

images = [
  // Productpage
  {
    name   = "bookinfo-productpage"
    source = "productpage"
  },
  // Details
  {
    name = "bookinfo-details"
    args = {
      service_version = "v1"
    }
    source = "details"
  },
  {
    name = "bookinfo-details"
    args = {
      service_version              = "v2"
      enable_external_book_service = true
    }
    source = "details"
  },

  // Reviews
  {
    name = "bookinfo-reviews"
    args = {
      service_version = "v1"
    }
    source = "reviews"
  },
  {
    name = "bookinfo-reviews"
    args = {
      service_version = "v2"
      enable_ratings  = true
    }
    source = "reviews"
  },
  {
    name = "bookinfo-reviews"
    args = {
      service_version = "v3"
      enable_ratings  = true
      star_color      = "red"
    }
    source = "reviews"
  },

  // Ratings
  {
    name = "bookinfo-ratings"
    args = {
      service_version = "v1"
    }
    source = "ratings"
  },
  {
    name = "bookinfo-ratings"
    args = {
      service_version = "v2"
    }
    source = "ratings"
  }
]

target "default" {
  matrix = {
    item = images
  }
  name = "${item.name}-${lookup(lookup(item, "args", {}),"service_version","v1")}"
  context = "./${item.source}"
  tags = [
    "${HUB}/${item.name}:${lookup(lookup(item, "args", {}), "service_version", "v1")}"
  ]
  args = lookup(item, "args", {})
  platforms = split(",", lookup(item, "platforms", PLATFORMS))
}
