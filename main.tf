terraform {
  required_version = ">= 1.0"
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 5.0"
    }
  }
}

provider "oci" {
  region = var.region
}

# Ejemplo simple - Compute Instance para ejecutar Nexa-Bot
resource "oci_core_instance" "nexa_bot" {
  compartment_id      = var.compartment_id
  availability_domain = "rEST:EU-MADRID-1-AD-1"
  
  display_name = "nexa-bot-instance"
  shape        = "VM.Standard.E2.1.Micro"  # Free tier elegible
  
  create_vnic_details {
    subnet_id                 = var.subnet_id
    assign_public_ip          = true
    hostname_label            = "nexa-bot"
    private_ip                = "10.0.0.2"
  }

  source_details {
    source_type             = "IMAGE"
    source_id               = var.image_id  # Ubuntu 22.04 o similar
    boot_volume_size_in_gbs = 50
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data           = base64encode(file("${path.module}/user-data.sh"))
  }

  freeform_tags = {
    "app" = "nexa-bot"
  }
}


output "instance_public_ip" {
  value       = oci_core_instance.nexa_bot.public_ip
  description = "Public IP de la instancia"
}
