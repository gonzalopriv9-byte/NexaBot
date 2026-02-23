variable "region" {
  description = "Región de Oracle Cloud"
  default = "eu-madrid-1"
}

variable "compartment_id" {
  description = "OCID del compartment"
  type = string
  default = "ocid1.tenancy.oc1..aaaaaaaa4jazq73q5ytxp4itu6wu2kivwhhfrsw3rx6354oanusrxq7nhs4a"
}

variable "subnet_id" {
  description = "OCID de la subnet"
  type = string
  default = "ocid1.subnet.oc1.eu-madrid-1.aaaaaaaavk2zocaiixjfspbsuyqxo55vwntbi3j7zhwobdgslcts5hgxm2ta"
}

variable "image_id" {
  description = "OCID de la imagen (Ubuntu 22.04 free-tier)"
  type = string
  default = "ocid1.image.oc1.eu-madrid-1.aaaaaaaaci6hvfgdj73ukkmpyb3ilc5alg5qpyc3rknmlqfj5qwsv3emglfa"
}

variable "ssh_public_key" {
  description = "Tu clave SSH pública"
  type = string
  default = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDX5xKL2qPmhV0XYXQKmvzKJ4Zkx8Qk1H5Zy7KX5Z7X2Z5Z7Z5Z7Z5Z7Z5Z7Z5Z7Z5Z7Z5Z7Z5Z7Z5Z7Z5Z7Z5Z7Z5Z7Z5Z7Z5Z7Z5Z7Z5Z7Z5Z7Z5Z7Z5Z7Z5Z7Z5Z7Z5Z5 nexabot@oracle"
  sensitive = true
}
