variable "region" {
  description = "Región de Oracle Cloud"
  default     = "eu-madrid-1"
}

variable "compartment_id" {
  description = "OCID del compartment"
  type        = string
}

variable "subnet_id" {
  description = "OCID de la subnet"
  type        = string
}

variable "image_id" {
  description = "OCID de la imagen"
  type        = string
}

variable "ssh_public_key" {
  description = "Tu clave SSH pública"
  type        = string
  sensitive   = true
}
